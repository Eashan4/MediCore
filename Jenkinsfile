// VLE 7/9: CI/CD + DevSecOps pipeline. Needs a Jenkins agent with node, docker and ansible. Not run on the t3.micro (too small).
pipeline {
  agent any
  stages {
    stage('Install')        { steps { sh 'npm run install:all' } }
    stage('Secrets scan')   { steps { sh 'grep -rIE "AKIA[0-9A-Z]{16}|BEGIN (RSA )?PRIVATE KEY" backend/src frontend/src database && exit 1 || true' } }
    stage('Dependency audit'){ steps { sh 'npm --prefix backend audit --omit=dev --audit-level=high && npm --prefix frontend audit --omit=dev --audit-level=high' } }
    stage('Test')           { steps { sh 'npm test' } }
    stage('Build')          { steps { sh 'npm run build' } }
    stage('Docker images')  { steps { sh 'docker build -t medicore-api:$BUILD_NUMBER backend && docker build -t medicore-web:$BUILD_NUMBER frontend' } }
    stage('Deploy')         { steps { sh 'cd deploy/ansible && ansible-playbook -i inventory.ini deploy-website.yml' } }
  }
}
