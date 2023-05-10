import { Stack, StackProps, Duration } from 'aws-cdk-lib';
import { Function, Runtime, Code } from 'aws-cdk-lib/aws-lambda';
import {
  WebSocketApi,
  WebSocketStage,
  WebSocketRoute,
} from '@aws-cdk/aws-apigatewayv2-alpha';
import { WebSocketLambdaIntegration } from '@aws-cdk/aws-apigatewayv2-integrations-alpha';
import { Role, PolicyStatement, Effect } from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export class ChatWebhookStack extends Stack {
  public webSocketApi: WebSocketApi;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const socketHandler = new Function(this, 'Handler', {
      code: Code.fromInline(`
import json
import boto3
import time

def handler(event, context):
    route_key = event["requestContext"].get("routeKey")
    print(route_key)
    if route_key == "$connect":
        return connect(event, context)
    elif route_key == "$disconnect":
        return disconnect(event, context)
    elif route_key == "sendMessage":
        return send_message(event, context)

def connect(event, context):
    return {
        "statusCode": 200, "body": "Connected."
    }

def disconnect(event, context):
    return {
        "statusCode": 200, "body": "Disconnected."
    }

def send_message(event, context):
    apigw_management_api = boto3.client(
        'apigatewaymanagementapi',
        endpoint_url=f"https://{event['requestContext']['domainName']}/{event['requestContext']['stage']}"
    )

    post_data = json.loads(event['body'])['message']
    connection_id = event['requestContext']['connectionId']

    try:
        apigw_management_api.post_to_connection(ConnectionId=connection_id, Data=post_data)
        time.sleep(2) # Added 2-second delay
        apigw_management_api.post_to_connection(ConnectionId=connection_id, Data="hello again")
        print('sent')
        print(post_data)
    except Exception as e:
        print('excepted')
        print(e)
        return {'statusCode': 500, 'body': str(e)}
    return {'statusCode': 200, 'body': json.dumps({"message": f"Received: {post_data}"})}      
`),
      handler: 'index.handler',
      runtime: Runtime.PYTHON_3_9,
      timeout: Duration.seconds(30),
    });

    this.webSocketApi = new WebSocketApi(this, 'DavidsChatWebSocket', {
      apiName: 'Davids Chat Web Socket',
    });

    const connectRoute = new WebSocketRoute(this, 'ConnectRoute', {
      webSocketApi: this.webSocketApi,
      routeKey: '$connect',
      integration: new WebSocketLambdaIntegration(
        'ConnectIntegration',
        socketHandler
      ),
    });

    const disconnectRoute = new WebSocketRoute(this, 'DisconnectRoute', {
      webSocketApi: this.webSocketApi,
      routeKey: '$disconnect',
      integration: new WebSocketLambdaIntegration(
        'DisconnectIntegration',
        socketHandler
      ),
    });

    const sendMessageRoute = new WebSocketRoute(this, 'SendMessageRoute', {
      webSocketApi: this.webSocketApi,
      routeKey: 'sendMessage',
      integration: new WebSocketLambdaIntegration(
        'SendMessageIntegration',
        socketHandler
      ),
    });

    const gatewayStage = new WebSocketStage(this, 'GatewayStage', {
      webSocketApi: this.webSocketApi,
      stageName: 'wss',
      autoDeploy: true,
    });

    const executeApiPolicy = new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['execute-api:Invoke', 'execute-api:ManageConnections'],
      resources: [
        `arn:aws:execute-api:${this.region}:${this.account}:${this.webSocketApi.apiId}/*/*/*`,
      ],
    });

    socketHandler.role?.addToPrincipalPolicy(executeApiPolicy);
  }
}
