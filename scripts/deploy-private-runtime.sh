#!/usr/bin/env bash
set -euo pipefail

repository_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
runtime_env=${KOPICONTEXT_RUNTIME_ENV:-/etc/kopicontext/private-runtime.env}
tunnel_env=${KOPICONTEXT_TUNNEL_ENV:-/etc/kopicontext/cloudflared.env}

for required_file in "$runtime_env" "$tunnel_env"; do
  if [[ ! -r "$required_file" ]]; then
    echo "Required protected environment file is not readable: $required_file" >&2
    exit 1
  fi
done

docker compose --project-directory "$repository_root" --env-file "$runtime_env" \
  -f "$repository_root/compose.private-runtime.yaml" config --quiet
docker compose --project-directory "$repository_root" --env-file "$runtime_env" \
  -f "$repository_root/compose.private-runtime.yaml" up -d --build --remove-orphans

docker compose --project-directory "$repository_root" --env-file "$tunnel_env" \
  -f "$repository_root/compose.cloudflare-tunnel.yaml" config --quiet
docker compose --project-directory "$repository_root" --env-file "$tunnel_env" \
  -f "$repository_root/compose.cloudflare-tunnel.yaml" up -d --remove-orphans

for attempt in $(seq 1 30); do
  if docker compose --project-directory "$repository_root" --env-file "$runtime_env" \
    -f "$repository_root/compose.private-runtime.yaml" exec -T api \
    node -e "fetch('http://127.0.0.1:3001/v1/healthz',{headers:{Authorization:'Bearer '+process.env.PRIVATE_API_SERVICE_CREDENTIAL}}).then(r=>{if(!r.ok)throw new Error('health status '+r.status);console.log('Private API healthy')}).catch(()=>process.exit(1))"; then
    exit 0
  fi
  if [[ "$attempt" -lt 30 ]]; then
    echo "Waiting for private API health (attempt $attempt/30)..." >&2
    sleep 2
  fi
done

echo "Private API did not become healthy after 60 seconds." >&2
exit 1
