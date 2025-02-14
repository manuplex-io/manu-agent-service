#!/bin/bash

# Navigate to the directory containing the stack file
# cd /home/ec2-user/manu-agent-service || { echo "Failed to navigate to stack directory"; exit 1; }

echo "The current working directory is: $(pwd)"
echo "Authenticating with ECR..."
aws ecr get-login-password --region us-west-2 | docker login --username AWS --password-stdin 637423298319.dkr.ecr.us-west-2.amazonaws.com

# # Pull the latest image from ECR (ensure you specify the correct repository and image tag)
echo "Pulling latest image from ECR..."
docker pull 637423298319.dkr.ecr.us-west-2.amazonaws.com/manu/agent-services:latest

# Deploy the Docker stack
echo "Deploying Docker stack..."
docker stack deploy -c ../docker-stack.yml manu-agent-services-stack || { echo "Failed to deploy Docker stack"; exit 1; }

# Check if the stack was deployed successfully
echo "Deployment Successful"
