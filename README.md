# API Documentation
## Overview
This API provides insights into the energy consumption of Bitcoin transactions and blocks. It allows users to monitor and analyze the sustainability of the Bitcoin network by exposing data such as energy consumption per transaction, total energy consumption per day, and energy consumption by wallet address.

## GraphQL Endpoint
Access the GraphQL API at:

```sh
http://localhost:4000/graphql
```

# Queries

1. `energyConsumptionForBlock` :
Retrieve the energy consumption per transaction for a specific block.

## Arguments
- `blockHash (String!)` : The hash of the block you want to query.
- `limit (Int)` : The maximum number of transactions to return (default is 50).
- `offset (Int)` : The number of transactions to skip (default is 0).
### Returns
An array of `Transaction` objects containing the following fields:

- `hash (String!)` : The unique identifier of the transaction.
- `energyCost (Float!)` : The energy consumption of the transaction in kilowatt-hours (kWh).
### Example Query

``` sh
query {
  energyConsumptionForBlock(
    blockHash: "0000000000000000000a3ad7e2e6c4a4be27f6c6e6a4f0e6d6a4f0e6d6a4f0e6"
    limit: 10
    offset: 0
  ) {
    hash
    energyCost
  }
}
```
### Example Response
``` sh
{
  "data": {
    "energyConsumptionForBlock": [
      {
        "hash": "abcd1234efgh5678ijkl9012mnop3456qrst7890uvwx5678yzab9012cdef3456",
        "energyCost": 4560.0
      },
      {
        "hash": "1234abcd5678efgh9012ijkl3456mnop7890qrst5678uvwx9012yzab3456cdef",
        "energyCost": 2280.0
      }
      // Additional transactions...
    ]
  }
```

2. `totalEnergyConsumptionPerDay`:
Retrieve the total energy consumption per day over the last x number of days.

## Arguments
- `days (Int!)` : The number of days to retrieve data for (e.g., 7 for the last week).
## Returns
An array of `Floats`, each representing the total energy consumption in kWh for a day. The array is ordered from the most recent day to the oldest.

### Example Query
``` sh
query {
  totalEnergyConsumptionPerDay(days: 5)
}
```
### Example Response
``` sh
{
  "data": {
    "totalEnergyConsumptionPerDay": [
      1234567.89,
      1134567.89,
      1034567.89,
      934567.89,
      834567.89
    ]
  }
}
``` 
3. `totalEnergyConsumptionByAddress`:
Retrieve the total energy consumption of all transactions performed by a specific wallet address.

## Arguments
- `address (String!)` : The Bitcoin wallet address you want to query.
## Returns
A `Float` representing the total energy consumption in kWh for all transactions associated with the given address.

### Example Query
``` sh
query {
  totalEnergyConsumptionByAddress(address: "1BoatSLRHtKNngkdXEeobR76b53LETtpyT")
}
```
### Example Response
```sh
{
  "data": {
    "totalEnergyConsumptionByAddress": 567890.12
  }
}
```


4. hello
A simple greeting to test the API.

Returns
A String message.

Example Query
graphql
Copy code
query {
  hello
}
Example Response
json
Copy code
{
  "data": {
    "hello": "Hi there, good luck with the assignment!"
  }
}
Types
Transaction
Represents a Bitcoin transaction with energy consumption details.

hash (String!): The transaction hash.
energyCost (Float!): The calculated energy consumption in kWh.
Block
Represents a Bitcoin block containing transactions.

hash (String!): The block hash.
index (Int!): The block index (height).
time (Int!): The timestamp of the block.
transactions ([Transaction!]!): The list of transactions in the block.
Energy Consumption Calculation
Energy Cost per Byte: 4.56 kWh

Formula:

makefile
Copy code
energyCost = size_in_bytes * 4.56
The energy cost is calculated based on the size of the transaction or block in bytes multiplied by the energy cost per byte.

Caching Mechanism (Optional Feature)
The API uses Redis to cache data and reduce the number of calls to the Blockchain API. Cached data includes:

Block data
Transaction data
Address transactions
Energy consumption calculations
Cache Keys Used:

block:<blockHash>: Stores block data including transactions.
address:<address>: Stores transactions associated with a wallet address.
blocksByDate:<dateMillis>: Stores blocks retrieved for a specific date.
totalEnergyConsumption:<dateMillis>: Stores total energy consumption calculated for a date.
Error Handling
The API provides meaningful error messages in case of failures, such as invalid inputs or issues with external API calls.
Logs are generated for cache hits, misses, and errors to aid in debugging.
Concurrency limits are set using p-limit to prevent exceeding API rate limits.
Dependencies
graphql-compose: For building the GraphQL schema.
axios: For making HTTP requests to the Blockchain API.
p-limit: To control the concurrency of asynchronous operations.
redis: For caching data to optimize API calls.
dotenv: To manage environment variables.