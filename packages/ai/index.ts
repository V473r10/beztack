import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
import { fromNodeProviderChain } from "@aws-sdk/credential-providers";

// Re-export AI SDK core functionality
export * from "ai";

// Re-export Amazon Bedrock provider
export const bedrock = createAmazonBedrock({
  region: "us-east-1",
  credentialProvider: fromNodeProviderChain(),
});
