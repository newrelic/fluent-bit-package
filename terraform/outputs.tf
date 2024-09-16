output "instance_ids" {
  description = "A map of instance IDs created by the ec2_instance module"
  value       = { for k, v in module.ec2_instance : k => v.id }
}