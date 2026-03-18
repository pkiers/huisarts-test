#!/bin/bash
set -euo pipefail

PROJECT="babbel-dev"
ZONE="europe-west1-b"
INSTANCE="huisarts-agent"

echo "=== Deploying to GCE VM: $INSTANCE ==="

# Get external IP
EXTERNAL_IP=$(gcloud compute instances describe $INSTANCE \
  --project=$PROJECT --zone=$ZONE \
  --format='get(networkInterfaces[0].accessConfigs[0].natIP)')

echo "VM IP: $EXTERNAL_IP"

# Copy files to VM
echo "--- Uploading files ---"
gcloud compute scp --recurse \
  --project=$PROJECT --zone=$ZONE \
  ../infra ../agent "$INSTANCE:~/huisarts/"

# SSH and start services
echo "--- Starting services ---"
gcloud compute ssh $INSTANCE \
  --project=$PROJECT --zone=$ZONE \
  --command="cd ~/huisarts/infra && docker compose up -d --build"

echo ""
echo "=== Deployment complete ==="
echo "LiveKit: ws://$EXTERNAL_IP:7880"
echo "SIP: $EXTERNAL_IP:5060"
