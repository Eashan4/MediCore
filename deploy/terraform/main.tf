# Terraform equivalent of deploy/aws-cli/create-infra.sh (Practice 7/8, VLE 4).
# Not applied or validated yet. Use: terraform init && terraform plan -var key_name=<your-key>
terraform {
  required_providers { aws = { source = "hashicorp/aws", version = "~> 5.0" } }
}
provider "aws" { region = "us-east-1" }

variable "key_name" { type = string }
variable "instance_profile" {
  type    = string
  default = "LabInstanceProfile"
}
variable "ssh_cidr" {
  type    = string
  default = "0.0.0.0/0" # set to <your-ip>/32
}

data "aws_caller_identity" "me" {}
data "aws_vpc" "default" { default = true }
data "aws_ssm_parameter" "ami" { name = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64" }

resource "aws_s3_bucket" "deploy" { bucket = "medicore-tf-${data.aws_caller_identity.me.account_id}" }
resource "aws_s3_bucket_public_access_block" "deploy" {
  bucket                  = aws_s3_bucket.deploy.id
  block_public_acls       = true
  ignore_public_acls      = true
  block_public_policy     = true
  restrict_public_buckets = true
}
resource "aws_s3_object" "bundle" {
  bucket = aws_s3_bucket.deploy.id
  key    = "medicore.tgz"
  source = "${path.module}/medicore.tgz" # build with the tar line from create-infra.sh
}

resource "aws_security_group" "web" {
  name   = "medicore-tf-sg"
  vpc_id = data.aws_vpc.default.id
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.ssh_cidr]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_instance" "app" {
  ami                    = data.aws_ssm_parameter.ami.value
  instance_type          = "t3.micro"
  key_name               = var.key_name
  iam_instance_profile   = var.instance_profile
  vpc_security_group_ids = [aws_security_group.web.id]
  user_data              = replace(file("${path.module}/../userdata.sh"), "medicore-deploy-REPLACE_ACCOUNT_ID", aws_s3_bucket.deploy.id)
  root_block_device {
    volume_size = 20
    volume_type = "gp3"
  }
  metadata_options { http_tokens = "required" }
  tags = { Name = "MediCore-tf" }
}

resource "aws_cloudwatch_metric_alarm" "cpu" {
  alarm_name          = "MediCore-tf-HighCPU"
  namespace           = "AWS/EC2"
  metric_name         = "CPUUtilization"
  dimensions          = { InstanceId = aws_instance.app.id }
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 2
  threshold           = 80
  comparison_operator = "GreaterThanThreshold"
}

output "public_ip" { value = aws_instance.app.public_ip }
