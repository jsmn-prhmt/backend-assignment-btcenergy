import { SchemaComposer } from 'graphql-compose';
import axios from 'axios';
import pLimit from 'p-limit';
import { createClient } from 'redis';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const schemaComposer = new SchemaComposer();

const ENERGY_COST_PER_BYTE = 4.56;

// Initialize Redis client with configuration from environment variables
const redisClient = createClient({
  socket: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT) || 6379,
  },
  password: process.env.REDIS_PASSWORD || undefined,
});

// Handle Redis client errors
redisClient.on('error', (err) => console.error('Redis Client Error', err));

// Connect to Redis server
(async () => {
  try {
    await redisClient.connect();
    console.log('Connected to Redis');
  } catch (error) {
    console.error('Failed to connect to Redis:', error);
  }
})();

// Utility functions for Redis caching
async function getFromCache(key: string) {
  const cachedData = await redisClient.get(key);
  if (cachedData) {
    console.log(`Cache hit for key: ${key}`);
    return JSON.parse(cachedData);
  } else {
    console.log(`Cache miss for key: ${key}`);
    return null;
  }
}

async function setToCache(key: string, value: any) {
  await redisClient.set(key, JSON.stringify(value));
  console.log(`Data cached for key: ${key}`);
}

// GraphQL type definitions

// Transaction GraphQL type
schemaComposer.createObjectTC({
  name: 'Transaction',
  fields: {
    hash: 'String!',
    energyCost: 'Float!',
    // size: 'Int!',
  },
});

// Block GraphQL type
schemaComposer.createObjectTC({
  name: 'Block',
  fields: {
    hash: 'String!',
    index: 'Int!',
    time: 'Int!',
    transactions: '[Transaction!]!',
  },
});

// Function to calculate energy cost
const calculateEnergyCost = (size: number) => size * ENERGY_COST_PER_BYTE;

// Utility function to fetch block transactions with energy cost
async function fetchBlockTransactionsWithEnergy(
  blockHash: string,
  limit: number,
  offset: number
) {
  const blockCacheKey = `block:${blockHash}`;

  // Check if block data is in Redis cache
  let block = await getFromCache(blockCacheKey);
  if (block) {
    const transactions = block.transactions.slice(offset, offset + limit);
    return transactions;
  }

  try {
    // Cache miss, fetch block data
    const response = await axios.get(
      `https://blockchain.info/rawblock/${blockHash}`
    );
    const blockData = response.data;

    const transactions = blockData.tx.map((tx: any) => ({
      hash: tx.hash,
      energyCost: calculateEnergyCost(tx.size),
      // size: tx.size,
    }));

    block = { 
      hash: blockData.hash,
      index: blockData.height,
      time: blockData.time,
      transactions,
    };

    // Store block data in Redis cache
    await setToCache(blockCacheKey, block);

    const paginatedTransactions = transactions.slice(offset, offset + limit);
    return paginatedTransactions;
    
  } catch (error: any) {
    throw new Error(`Failed to fetch block data: ${error.message}`);
  }
}

// Utility function to fetch all transactions for an address with energy cost
async function fetchAllTransactionsForAddress(address: string) {
  const addressCacheKey = `address:${address}`;

  // Check if address data is in Redis cache
  let cachedData = await getFromCache(addressCacheKey);
  if (cachedData) {
    console.log(`Cache hit for key: ${addressCacheKey}`);
    return cachedData.transactions;
  }

  try { 
    const allTransactions: any[] = [];

    // Initial API call to get total number of transactions
    const initialResponse = await axios.get(
      `https://blockchain.info/rawaddr/${address}?offset=0&limit=1`
    );
    const totalTxs = initialResponse.data.n_tx;
    const maxLimit = 50; // API's maximum limit per request
    const totalPages = Math.ceil(totalTxs / maxLimit);

    const limitRequests = pLimit(1);

    const tasks = []; 

    for (let i = 0; i < totalPages; i++) {
      const currentOffset = i * maxLimit;

      const task = limitRequests(async () => {
        try {
          const response = await axios.get(
            `https://blockchain.info/rawaddr/${address}?offset=${currentOffset}&limit=${maxLimit}`
          );
          const data = response.data;
          const transactions = data.txs.map((tx: any) => ({
            hash: tx.hash,
            energyCost: calculateEnergyCost(tx.size),
            // size: tx.size,
          }));

          return transactions;

        } catch (error: any) {
          console.error(
            `Failed to fetch transactions at offset ${currentOffset}: ${error.message}`
          );
          return [];
        }
      });

      tasks.push(task);
    }

    const results = await Promise.all(tasks);
    allTransactions.push(...results.flat());

    // Store transactions in Redis cache
    await setToCache(addressCacheKey, {
      transactions: allTransactions,
      timestamp: Date.now(), // Store timestamp for cache invalidation
    });

    return allTransactions;
  } catch (error: any) {
    throw new Error(
      `Failed to fetch transactions for address: ${error.message}`
    );
  }
}

// Fetch block data by date with Redis caching
const fetchBlockDataByDate = async (dateMillis: number) => {
  const cacheKey = `blocksByDate:${dateMillis}`;

  // Check if data is in Redis cache
  const cachedData = await getFromCache(cacheKey);
  if (cachedData) {
    return cachedData;
  }

  try {
    const response = await axios.get(
      `https://blockchain.info/blocks/${dateMillis}?format=json`
    );
    const blocks = response.data;

    // Check if blocks are returned as an array
    if (!Array.isArray(blocks)) {
      throw new Error('No blocks data returned for the given date.');
    }

    console.log(
      `Fetched ${blocks.length} blocks for ${new Date(
        dateMillis
      ).toISOString()}` // ISO format : yyyy-mm-ddThh:mm:ss.sssZ
    );

    // Store fetched data in Redis cache
    await setToCache(cacheKey, blocks);
    return blocks;

  } catch (error: any) {
    throw new Error(
      `Failed to fetch block data for date ${dateMillis}: ${error.message}`
    );
  }
};

// Calculate total energy consumption with Redis caching
const calculateTotalEnergyConsumption = async (
  blocks: { hash: string }[]
) => {
  const limit = pLimit(20); 

  const totalEnergyConsumptionArray: number[] = await Promise.all(
    blocks.map((block) =>
      limit(async () => {
        try {
          let blockData;
          const blockCacheKey = `block:${block.hash}`;

          // Check if block data is in Redis cache
          blockData = await getFromCache(blockCacheKey);
          if (!blockData) {
            // Cache miss, fetch block data
            const blockResponse = await axios.get(
              `https://blockchain.info/rawblock/${block.hash}`
            );
            blockData = blockResponse.data;

            // Store block data in Redis cache
            await setToCache(blockCacheKey, blockData);
          }

          // // Check if the block has any transactions
          // if (!blockData.tx || blockData.tx.length === 0) {
          //   return 0;
          // }

          // // Calculate energy cost for the block
          // const blockEnergyCost = blockData.tx.reduce(
          //   (blockTotal: number, tx: { size: number }) => {
          //     return blockTotal + calculateEnergyCost(tx.size);
          //   },
          //   0
          // );

          // Calculate energy cost for the block size
          if (!blockData.size) {
            return 0;
          }
          const blockEnergyCost = calculateEnergyCost(blockData.size);

          return blockEnergyCost;
        } catch (error: any) {
          console.error(
            `Failed to fetch data for block ${block.hash}: ${error.message}`
          );
          return 0;
        }
      })
    )
  );

  // Sum up the total energy consumption
  return totalEnergyConsumptionArray.reduce(
    (total, blockEnergyCost) => total + blockEnergyCost,
    0
  );
};

// Add queries to the GraphQL schema
schemaComposer.Query.addFields({
  hello: {
    type: 'String!',
    resolve: () => 'Hi there, good luck with the assignment!',
  },

  // Provide the energy consumption per transaction for a specific block
  energyConsumptionForBlock: {
    type: '[Transaction!]!', 
    args: {
      blockHash: 'String!',
      limit: { type: 'Int', defaultValue: 50 },
      offset: { type: 'Int', defaultValue: 0 },
    }, 
    resolve: async (_, { blockHash, limit, offset }) => { 
      return await fetchBlockTransactionsWithEnergy(blockHash, limit, offset);
    },
  },

  // Provide total energy consumption per day over the last 'days' number of days
  totalEnergyConsumptionPerDay: {
    type: '[Float!]!',
    args: { days: 'Int!' },
    resolve: async (_, { days }) => {
      const limit = pLimit(5); 
      const today = new Date(
        Date.UTC(
          new Date().getUTCFullYear(),
          new Date().getUTCMonth(),
          new Date().getUTCDate()
        )
      );

      const tasks = [];
      for (let i = 0; i < days; i++) {
        tasks.push(
          limit(async () => {
            const date = new Date(today.getTime() - i * 86400000);
            const millis = date.getTime();
            const cacheKey = `totalEnergyConsumption:${millis}`;

            // Check cache
            const cachedTotalEnergy = await getFromCache(cacheKey);
            if (cachedTotalEnergy !== null) {
              console.log(`Cache hit for key: ${cacheKey}`);
              return cachedTotalEnergy;
            }

            try {
              const blocks = await fetchBlockDataByDate(millis);
              let totalEnergyConsumption = 0;
              if (blocks && blocks.length > 0) {
                totalEnergyConsumption = await calculateTotalEnergyConsumption(
                  blocks
                );
              } else {
                console.log(`No blocks found for date ${millis}`);
              }
              // Cache the result
              await setToCache(cacheKey, totalEnergyConsumption);
              return totalEnergyConsumption;
            } catch (error: any) {
              console.error(
                `Error processing date ${millis}: ${error.message}`
              );
              // Cache the error result as 0
              await setToCache(cacheKey, 0);
              return 0;
            }
          })
        );
      }

      // Wait for all tasks to complete
      const results = await Promise.all(tasks);
      return results;
    },
  },

  // Provide total energy consumption of all transactions by a specific wallet address
  totalEnergyConsumptionByAddress: {
    type: 'Float!',
    args: {
      address: 'String!',
    },
    resolve: async (_, { address }) => {
      try {
        const transactions = await fetchAllTransactionsForAddress(address);

        const totalEnergyConsumption = transactions.reduce(
          (sum: number, tx: any) => sum + tx.energyCost,
          0
        );

        // Optionally cache the total energy consumption separately if needed
        return totalEnergyConsumption;
      } catch (error: any) {
        throw new Error(
          `Failed to calculate total energy consumption for address: ${error.message}`
        );
      }
    },
  },
});

// Build and export the GraphQL schema
export const schema = schemaComposer.buildSchema();