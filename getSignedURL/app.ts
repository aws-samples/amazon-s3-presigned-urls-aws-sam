/*
  Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
  Modifications copyright 2024 Fireproof Storage Incorporated. All Rights Reserved.
  Permission is hereby granted, free of charge, to any person obtaining a copy of this
  software and associated documentation files (the "Software"), to deal in the Software
  without restriction, including without limitation the rights to use, copy, modify,
  merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
  permit persons to whom the Software is furnished to do so.
  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
  INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
  PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
  HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
  OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
  SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

"use strict";
import AWS from "aws-sdk";
import { CID } from "multiformats";
import { base64pad } from "multiformats/bases/base64";
import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
  PutCommand,
  GetCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";

// @ts-ignore
// AWS.config.update({region: 'us-east-1'})
AWS.config.update({ region: process.env.AWS_REGION });
const client = new DynamoDBClient({});
const dynamo = DynamoDBDocumentClient.from(client);
const tableName = "metaStore";
const s3 = new AWS.S3({
  signatureVersion: "v4",
});

// Change this value to adjust the signed URL's expiration
const URL_EXPIRATION_SECONDS = 300;

// Main Lambda entry point
export const handler = async (event) => {
  return await getUploadURL(event).catch((error) => {
    console.error("Error:", error);
    return {
      status: 500,
      body: JSON.stringify({
        message: "Internal Server Error",
        error: error.message,
      }),
    };
  });
};

const getUploadURL = async function (event) {
  const { queryStringParameters } = event;
  const type = queryStringParameters.type;
  const name = queryStringParameters.name;
  if (!type || !name) {
    throw new Error(
      "Missing name or type query parameter: " + event.rawQueryString
    );
  }

  let s3Params;

  if (type === "data" || type === "file") {
    s3Params = carUploadParams(queryStringParameters, event, type);
    const uploadURL = await s3.getSignedUrlPromise("putObject", s3Params);

    return JSON.stringify({
      uploadURL: uploadURL,
      Key: s3Params.Key,
    });
  } else if (type === "meta") {
    return await metaUploadParams(queryStringParameters, event);
  } else {
    throw new Error("Unsupported upload type: " + type);
  }
};

async function metaUploadParams(queryStringParameters, event) {
  const name = queryStringParameters.name;
  const httpMethod = event.requestContext.http.method;
  if (httpMethod == "PUT") {
    const requestBody = JSON.parse(event.body);
    if (requestBody) {
      const { data, cid, parents } = requestBody;
      if (!data || !cid) {
        throw new Error(
          "Missing data or cid from the metadata:" + event.rawQueryString
        );
      }

      //name is the partition key and cid is the sort key for the DynamoDB table
      await dynamo.send(
        new PutCommand({
          TableName: tableName,
          Item: {
            name: name,
            cid: cid,
            data: data,
          },
        })
      );

      for (const p of parents) {
        await dynamo.send(
          new DeleteCommand({
            TableName: tableName,
            Key: {
              name: name,
              cid: p,
            },
          })
        );
      }

      return {
        status: 201,
        body: JSON.stringify({ message: "Metadata has been added" }),
      };
    } else {
      return {
        status: 400,
        body: JSON.stringify({ message: "JSON Payload data not found!" }),
      };
    }
  } else if (httpMethod === "GET") {
    const command = new QueryCommand({
      ExpressionAttributeValues: {
        ":v1": {
          S: name,
        },
      },
      ExpressionAttributeNames: {
        "#nameAttr": "name",
        "#dataAttr": "data",
      },
      KeyConditionExpression: "#nameAttr = :v1",
      ProjectionExpression: "cid, #dataAttr",
      TableName: tableName,
    });
    const data = await dynamo.send(command);
    // const data = await dynamoDB.scan(params).promise();
    //This means items is an array of objects where each object contains a string key and a value of any type
    //: { [key: string]: any; }[]
    let items: { [key: string]: any; }[] = [];
    if (data.Items && data.Items.length > 0) {
      items = data.Items.map((item) => AWS.DynamoDB.Converter.unmarshall(item));
      return {
        status: 200,
        body: JSON.stringify({ items }),
      };
    } else {
      return {
        status: 200,
        body: JSON.stringify({ items: [] }),
      };
    }
  } else {
    return {
      status: 400,
      body: JSON.stringify({ message: "Invalid HTTP method" }),
    };
  }
}

function carUploadParams(queryStringParameters, event, type) {
  const name = queryStringParameters.name;
  const carCid = queryStringParameters.car;
  if (!carCid || !name) {
    throw new Error(
      "Missing name or car query parameter: " + event.rawQueryString
    );
  }

  const cid = CID.parse(carCid);
  const checksum = base64pad.baseEncode(cid.multihash.digest);

  const Key = `${type}/${name}/${cid.toString()}.car`;

  const s3Params = {
    // @ts-ignore
    Bucket: process.env.UploadBucket,
    // Bucket: "sam-app-s3uploadbucket-e6rv1dj2kydh",
    Key,
    Expires: URL_EXPIRATION_SECONDS,
    ContentType: "application/car",
    ChecksumSHA256: checksum,
    ACL: "public-read",
  };
  return s3Params;
}
