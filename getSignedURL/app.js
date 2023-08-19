/*
  Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
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

'use strict'

const AWS = require('aws-sdk')
const { CID } = require('multiformats/cid')
const { base64pad } = require('multiformats/bases/base64')

AWS.config.update({ region: process.env.AWS_REGION })
const s3 = new AWS.S3()

// Change this value to adjust the signed URL's expiration
const URL_EXPIRATION_SECONDS = 300

// Main Lambda entry point
exports.handler = async (event) => {
  return await getUploadURL(event)
}

const getUploadURL = async function(event) {
  const { searchParams } = new URL(`http://localhost/?${event.rawQueryString}`)
  const type = searchParams.get('type')
  if (!type) { throw new Error('Missing type query parameter: ' + event.rawQueryString) } 
  let s3Params
  let Key
  if (type === 'data') {
     ({ s3Params, Key }) = carUploadParams(searchParams, event)

  } else if (type === 'meta') {
     ({ s3Params, Key }) = metaUploadParams(searchParams, event)

  } else {
    throw new Error('Unsupported upload type: ' + type)
  }

  console.log('Params: ', s3Params)
  const uploadURL = await s3.getSignedUrlPromise('putObject', s3Params)

  return JSON.stringify({
    uploadURL: uploadURL,
    Key
  })
}

function metaUploadParams(searchParams, event) {
  const name = searchParams.get('name')
  const branch = searchParams.get('branch')
  if (!name || !branch) { throw new Error('Missing name or branch query parameter: ' + event.rawQueryString) }

  // this need validation based on user id
  const Key = `meta/${name}/${branch}.json`

  const s3Params = {
    Bucket: process.env.UploadBucket,
    Key,
    Expires: URL_EXPIRATION_SECONDS,
    ContentType: 'application/json',
    ACL: 'public-read'
  }
  return { s3Params, Key }
}

function carUploadParams(searchParams, event) {
  const name = searchParams.get('name')
  const carCid = searchParams.get('car')
  const size = parseInt(searchParams.get('size'))
  if (!carCid || !size || !name) {
    throw new Error('Missing name, car or size query parameter: ' + event.rawQueryString)
  }

  const cid = CID.parse(carCid)
  const checksum = base64pad(cid.multihash.digest)

  const Key = `data/${name}/${carCid}.car`

  const s3Params = {
    Bucket: process.env.UploadBucket,
    Key,
    Expires: URL_EXPIRATION_SECONDS,
    ContentType: 'application/car',
    ChecksumSHA256: checksum,
    ContentLength: size,
    ACL: 'public-read'
  }
  return { s3Params, Key }
}
