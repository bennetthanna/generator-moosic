'use strict';

const Generator = require('yeoman-generator');
const fs = require('fs-extra');
const AWS = require('aws-sdk');

const resourceTypePrompts = [
    {
        type: 'list',
        name: 'uploadType',
        message: 'What kind of upload would you like to perform?',
        choices: [
            'MP3 File',
            'Album',
            'Artist'
        ]
    },
    {
        type: 'input',
        name: 'keyName',
        message: 'What would you like it to be named?',
        validate(answer) {
            if (/^[a-zA-Z0-9]*$/.test(answer)) {
                return true;
            }
            return 'Name must only contain alphanumeric characters.';
        }
    },
    {
        type: 'input',
        name: 'resourceLocation',
        message: 'Where is this located?',
        validate(answer) {
            if (fs.existsSync(answer)) {
                return true;
            }
            return 'Not found. Enter a valid relative path.'
        }
    }
];

let uploadType;
let keyName;
let resourceLocation;

module.exports = class extends Generator {
    promptResourceType() {
        const done = this.async();
        return this.prompt(resourceTypePrompts).then(answers => {
            uploadType = answers.uploadType;
            keyName = answers.keyName;
            resourceLocation = answers.resourceLocation;
            done();
        });
    }

    uploadToS3() {
        const done = this.async();
        const sts = new AWS.STS();
        const assumeRoleParams = {
            RoleArn: 'arn:aws:iam::171578128461:role/full-s3-access',
            RoleSessionName: 'MoosicSession'
        }

        const assumeRole = sts.assumeRole(assumeRoleParams).promise();

        assumeRole
            .then(res => {
                const assumedRoleCredentials = {
                    accessKeyId: res.Credentials.AccessKeyId,
                    secretAccessKey: res.Credentials.SecretAccessKey,
                    sessionToken: res.Credentials.SessionToken
                };
                const s3 = new AWS.S3(assumedRoleCredentials);
                return s3.listObjectsV2({ Bucket: 'bucket-o-luv', MaxKeys: 2 }).promise();
            })
            .then(res => {
                console.log(res);
            })
            .catch(err => {
                console.log(err);
            });
    }
};
