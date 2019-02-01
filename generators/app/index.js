'use strict';

const Generator = require('yeoman-generator');
const fs = require('fs-extra');
const AWS = require('aws-sdk');
const _  = require('lodash');
const glob = require('glob');

const BUCKET = 'bucket-o-moosic';

let uploadType;
let keyName;
let resourceLocation;
let s3;

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
            if (/^[a-zA-Z0-9-_]*$/.test(answer)) {
                return true;
            }
            return 'Name must only contain alphanumeric characters, dashes, or underscores.';
        }
    },
    {
        type: 'input',
        name: 'resourceLocation',
        message: 'Where is this file located?',
        validate(answer) {
            const stats = fs.statSync(answer);
            if (fs.existsSync(answer) && stats.isFile()) {
                return true;
            }
            return 'File not found. Enter a valid relative path.'
        },
        when(answers) {
            return answers.uploadType === 'MP3 File';
        }
    },
    {
        type: 'input',
        name: 'resourceLocation',
        message: 'Where is this directory located?',
        validate(answer) {
            const stats = fs.statSync(answer);
            if (fs.existsSync(answer) && stats.isDirectory()) {
                return true;
            }
            return 'Directory not found. Enter a valid relative path.'
        },
        when(answers) {
            return _.includes(['Album', 'Artist'], answers.uploadType);
        }
    }
];

function getData(fileName) {
    return new Promise(function(resolve, reject) {
        fs.readFile(fileName, (err, data) => {
            err ? reject(err) : resolve(data);
        });
    });
}

function getFiles(location, pattern) {
    return new Promise(function(resolve, reject) {
        return glob(location + pattern, (err, matches) => {
            if (err) {
                return reject(err);
            }
            const files = _.filter(matches, (match) => fs.statSync(match).isFile());
            return resolve(files);
        });
    })
}

function uploadFile(location, prefix) {
    return getData(location)
        .then(res => s3.putObject({ Bucket: BUCKET, Key: prefix, Body: res}).promise())
        .then(res => res)
        .catch(err => err);
}

module.exports = class extends Generator {
    assumeRole() {
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
                s3 = new AWS.S3(assumedRoleCredentials);
                done();
            })
            .catch(err => {
                console.log(`Whoopsie daisies! Looks like an error occured when trying to assume role: ${err.message}`);
                process.exit(1);
            });
    }

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

        if (uploadType === 'MP3 File') {
            uploadFile(resourceLocation, keyName)
                .then(res => {
                    console.log(res);
                    done();
                })
                .catch(err => {
                    console.log(`Hold the phone! An error occured when uploading your file: ${err.message}`);
                    done();
                });
        } else {
            const pattern = uploadType === 'Album' ? '/*' : '/**/*';
            getFiles(resourceLocation, pattern)
                .then(files => {
                    const promises = _.map(files, file => {
                        const fileName = uploadType === 'Album' ? _.last(file.split('/')) : _.takeRight(file.split('/'), 2).join('/');
                        return uploadFile(file, `${keyName}/${fileName}`);
                    });
                    return Promise.all(promises);
                })
                .then(res => {
                    console.log(res);
                    done();
                })
                .catch(err => {
                    console.log(`Uh oh spaghettios! Something went wrong when uploading your files: ${err.message}`);
                    done();
                });
        }
    }
};
