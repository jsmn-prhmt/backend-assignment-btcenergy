import { schema } from './schema';
import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import CreateLambdaApi from 'lambda-api';
import { getGraphQLParameters, processRequest } from 'graphql-helix';
import type { API, HandlerFunction } from 'lambda-api';
import type { GraphQLSchema } from 'graphql';

// Create an instance of the lambda-api framework
export function APIGatewayLambda() {
  const isTest = process.env.NODE_ENV === 'test';
  const isOffline = process.env.IS_OFFLINE === 'true';

  return CreateLambdaApi({
    version: 'v2',
    logger: isTest
      ? false
      : {
          level: isOffline ? 'debug' : 'info',
        },
  });
}

// GraphQL API handler using graphql-helix for processing requests
export const graphqlApi = /* #__PURE__ */ <TContext>(
  schema: GraphQLSchema,
  contextFactory?: () => Promise<TContext> | TContext,
): HandlerFunction => {
  return async function graphqlHandler(req, res) {
    const request = {
      body: req.body,
      headers: req.headers,
      method: req.method,
      query: req.query,
    };

    const { query, variables, operationName } = getGraphQLParameters(request);

    const result = await processRequest({
      schema,
      query,
      variables,
      operationName,
      request,
      contextFactory,
    });

    if (result.type === 'RESPONSE') {
      result.headers.forEach(({ name, value }) => {
        res.header(name, value);
      });
      res.status(result.status);
      res.json(result.payload);
    } else {
      req.log.error(`Unhandled: ${result.type}`);
      res.error(`Unhandled: ${result.type}`);
    }
  };
};

// Wrap the API with the AWS Lambda handler
export function mkAPIGatewayHandler(api: API): APIGatewayProxyHandlerV2 {
  return async function apiGatewayHandler(event, ctx) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return api.run(event as any, ctx);
  };
}

// Create an instance of the lambda-api framework
const api = APIGatewayLambda(); 

// Attach the GraphQL API handler to all HTTP methods
api.any(graphqlApi(schema));

// Export the Lambda handler for AWS Lambda to use
export const handler: APIGatewayProxyHandlerV2 = mkAPIGatewayHandler(api);