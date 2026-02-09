#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 3 ]; then
  echo "Usage: $0 <agent_id> <bot_token> <agent_name>" >&2
  exit 1
fi

agent_id="$1"
bot_token="$2"
agent_name="$3"

remote="root@45.76.180.239"
ssh_opts=(-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=10)

escaped_agent_id=$(printf '%q' "$agent_id")
escaped_bot_token=$(printf '%q' "$bot_token")
escaped_agent_name=$(printf '%q' "$agent_name")

container_id=$(ssh "${ssh_opts[@]}" "$remote" \
  "AGENT_ID=$escaped_agent_id BOT_TOKEN=$escaped_bot_token AGENT_NAME=$escaped_agent_name bash -lc 'docker run -d --name agent-${AGENT_ID} -e TELEGRAM_BOT_TOKEN=${BOT_TOKEN} -e DEEPSEEK_API_KEY=***REMOVED_DEEPSEEK_KEY*** -e AGENT_NAME=${AGENT_NAME} openclaw-agent:latest'")

container_id=$(echo "$container_id" | tail -n 1 | tr -d '\r')
if [ -z "$container_id" ]; then
  echo "Failed to get container id" >&2
  exit 1
fi

echo "$container_id"
