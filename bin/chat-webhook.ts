#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { ChatWebhookStack } from '../lib/chat-webhook-stack';

const app = new cdk.App();
new ChatWebhookStack(app, 'dev-ChatWebhookStack');
// new ChatWebhookStack(app, 'prod-ChatWebhookStack');
