#!/bin/bash
# VLE 3 - infrastructure creation with the AWS CLI (what was run to create the live stack).
# Needs: ./deploy/userdata.sh (bootstrap), medicore.tgz built from the repo, an EC2 key pair named in KEY_NAME.
set -euo pipefail
KEY_NAME=${KEY_NAME:-my-key}   # your EC2 key pair
REGION=us-east-1; ACCT=$(aws sts get-caller-identity --query Account --output text)
B=medicore-deploy-$ACCT
aws s3 mb s3://$B --region $REGION                                  # S3 bucket (code + DB backups)
aws s3api put-public-access-block --bucket $B --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
tar --exclude=node_modules --exclude=.git --exclude=.env --exclude=frontend/src -czf /tmp/medicore.tgz backend database frontend/dist docker-compose.yml package.json
aws s3 cp /tmp/medicore.tgz s3://$B/medicore.tgz
sed "s/REPLACE_ACCOUNT_ID/$ACCT/" deploy/userdata.sh > /tmp/medicore-userdata.sh   # bucket name carries your account id
VPC=$(aws ec2 describe-vpcs --filters Name=isDefault,Values=true --query 'Vpcs[0].VpcId' --output text)
SG=$(aws ec2 create-security-group --group-name medicore-sg --description "MediCore web+ssh" --vpc-id $VPC --query GroupId --output text)
aws ec2 authorize-security-group-ingress --group-id $SG --ip-permissions \
  IpProtocol=tcp,FromPort=80,ToPort=80,IpRanges='[{CidrIp=0.0.0.0/0}]' \
  IpProtocol=tcp,FromPort=22,ToPort=22,IpRanges="[{CidrIp=${SSH_CIDR:-0.0.0.0/0}}]"   # set SSH_CIDR=<your-ip>/32 to restrict SSH
AMI=$(aws ssm get-parameter --name /aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64 --query Parameter.Value --output text)
aws ec2 run-instances --image-id $AMI --instance-type t3.micro --key-name $KEY_NAME --security-group-ids $SG \
  --iam-instance-profile Name=${INSTANCE_PROFILE:-LabInstanceProfile} --block-device-mappings 'DeviceName=/dev/xvda,Ebs={VolumeSize=20,VolumeType=gp3}' \
  --user-data file:///tmp/medicore-userdata.sh --metadata-options HttpTokens=required \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=MediCore}]'
