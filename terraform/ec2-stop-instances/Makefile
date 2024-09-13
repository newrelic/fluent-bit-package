# Terraform-stop
.PHONY: stop
stop: 
	terraform init -reconfigure && \
	terraform refresh
	aws ec2 stop-instances --region us-east-2 --instance-ids $(terraform output -json instance_ids | jq -r '.[]' | paste -sd ' ' -) ;
	@echo "EC2 instances stopped."