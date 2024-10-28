
# Single Block
curl -X GET "https://blockchain.info/rawblock/00000000000000000002765d0259887d8e9550ee976fc452f395fc1aeccbee48?format=json" | jq > out.json

# Latest Block
curl -X GET "https://blockchain.info/latestblock" | jq > out.json

# Blocks by Date
curl -X GET "https://blockchain.info/blocks/1609459200000?format=json" | jq > out.json

# Provide the energy consumption per transaction for a specific block
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query ($blockHash: String!, $limit: Int = 50, $offset: Int = 0) { energyConsumptionForBlock(blockHash: $blockHash, limit: $limit, offset: $offset) { hash energyCost } }",
    "variables": {
      "blockHash": "00000000000000000002765d0259887d8e9550ee976fc452f395fc1aeccbee48",
      "limit": 50,
      "offset": 0
    }
  }' | jq > out.json

# Provide total energy consumption per day over the last 'days' number of days
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query ($days: Int!) { totalEnergyConsumptionPerDay(days: $days) }",
    "variables": {
      "days": 2
    }
  }' | jq > out.json

# Provide the energy consumption per transaction for a specific block
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{ 
    "query": "query($address: String!) { totalEnergyConsumptionByAddress(address: $address) }",
    "variables": { 
      "address": "1A8JiWcwvpY7tAopUkSnGuEYHmzGYfZPiq" 
    }
  }' | jq > out.json