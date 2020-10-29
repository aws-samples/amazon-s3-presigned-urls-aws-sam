# S3 presigned URLs with SAM, auth and sample frontend

This example application shows how to upload objects to S3 directly from your end-user application using Signed URLs.

To learn more about how this application works, see the AWS Compute Blog post: https://aws.amazon.com/blogs/compute/uploading-to-amazon-s3-directly-from-a-web-or-mobile-application/

Important: this application uses various AWS services and there are costs associated with these services after the Free Tier usage - please see the [AWS Pricing page](https://aws.amazon.com/pricing/) for details. You are responsible for any AWS costs incurred. No warranty is implied in this example.

```bash
.
├── README.MD                   <-- This instructions file
├── frontend                    <-- Simple JavaScript application illustrating upload
├── getSignedURL                <-- Source code for the serverless backend
```

## Requirements

* AWS CLI already configured with Administrator permission
* [AWS SAM CLI installed](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-install.html) - minimum version 0.48.
* [NodeJS 12.x installed](https://nodejs.org/en/download/)

## Installation Instructions

1. [Create an AWS account](https://portal.aws.amazon.com/gp/aws/developer/registration/index.html) if you do not already have one and login.

2. Clone the repo onto your local development machine using `git clone`.

### Installing the application

There are two SAM templates available - one provides an open API, the other uses an authorizer. From the command line, deploy the chosen SAM template:

```
cd .. 
sam deploy --guided
```

When prompted for parameters, enter:
- Stack Name: s3Uploader
- AWS Region: your preferred AWS Region (e.g. us-east-1)
- Accept all other defaults.

This takes several minutes to deploy. At the end of the deployment, note the output values, as you need these later.

- The APIendpoint value is important - it looks like https://ab123345677.execute-api.us-west-2.amazonaws.com.
- **The upload URL is your endpoint** with the /uploads route added - for example: https://ab123345677.execute-api.us-west-2.amazonaws.com/uploads.


### Testing with the frontend application

The frontend code is saved in the `frontend` subdirectory. 

1. Before running, you need to set the API Gateway endpoint from the backend deployment on line 29 in the `index.html` file.

2. You cannot run this directly on a local browser, due to way CORS works with localhost. Either [copy the file to an S3 bucket](https://docs.aws.amazon.com/AmazonS3/latest/user-guide/upload-objects.html), or [deploy using AWS Amplify Console](https://aws.amazon.com/amplify/console/).

3. Once the page is loaded from a remote location, upload a JPG file in the front-end and you will see the object in the backend S3 bucket.

## Next steps

The AWS Compute Blog post at the top of this README file contains additional information about this pattern.

If you have any questions, please raise an issue in the GitHub repo.

==============================================

Copyright 2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.

SPDX-License-Identifier: MIT-0
