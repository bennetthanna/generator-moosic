'use strict';

const Generator = require('yeoman-generator');
const fs = require('fs-extra');
const AWS = require('aws-sdk');
const _  = require('lodash');
const glob = require('glob');

const BUCKET = 'bucket-o-moosic';
const TABLE = 'moosic';

let genre;
let uploadType;
let keyName;
let resourceLocation;
let s3;
let dynamoDb;
let moosicFiles;

const moosicPrompts = [
    {
        type: 'list',
        name: 'uploadType',
        message: 'What kind of upload would you like to perform?',
        choices: [
            'Song',
            'Album',
            'Artist'
        ]
    },
    {
        type: 'input',
        name: 'genre',
        message: 'What is the genre of this moosic?',
        validate(answer) {
            if (/^[a-zA-Z0-9-_.]*$/.test(answer) && answer.trim()) {
                return true;
            }
            return 'Genre must only contain alphanumeric characters, dashes, or underscores.';
        }
    },
    {
        type: 'input',
        name: 'keyName',
        message: 'What would you like it to be named?',
        validate(answer) {
            if (/^[a-zA-Z0-9-_.]*$/.test(answer) && answer.trim()) {
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
            if (fs.existsSync(answer) && fs.statSync(answer).isFile()) {
                return true;
            }
            return 'File not found. Enter a valid relative path.'
        },
        when(answers) {
            return answers.uploadType === 'Song';
        }
    },
    {
        type: 'input',
        name: 'resourceLocation',
        message: 'Where is this directory located?',
        validate(answer) {
            if (fs.existsSync(answer) && fs.statSync(answer).isDirectory()) {
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
            RoleArn: 'arn:aws:iam::171578128461:role/moosic-s3-access',
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
                dynamoDb = new AWS.DynamoDB.DocumentClient(assumedRoleCredentials);
                done();
            })
            .catch(err => {
                console.log(`Whoopsie daisies! Looks like an error occured when trying to assume role: ${err.message}`);
                process.exit(1);
            });
    }

    promptMoosic() {
        const done = this.async();
        return this.prompt(moosicPrompts).then(answers => {
            genre = answers.genre;
            uploadType = answers.uploadType;
            keyName = answers.keyName;
            resourceLocation = answers.resourceLocation;
            done();
        });
    }

    uploadToS3() {
        console.log('Uploading to S3...');
        const done = this.async();

        if (uploadType === 'Song') {
            uploadFile(resourceLocation, keyName)
                .then(res => {
                    console.log(res);
                    const item = {
                        Song: {
                            S: keyName
                        },
                        Genre: {
                            S: genre
                        },
                        S3Key: {
                            S: keyName
                        }
                    };
                    console.log(item);
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
                    moosicFiles = files;
                    const promises = _.map(files, file => {
                        const fileName = uploadType === 'Album' ? _.last(file.split('/')) : _.takeRight(file.split('/'), 2).join('/');
                        return uploadFile(file, `${keyName}/${fileName}`);
                    });
                    return Promise.all(promises);
                })
                .then(res => {
                    console.log(res);
                    const promises = _.map(moosicFiles, file => {
                        const fileParts = uploadType === 'Album' ? _.last(file.split('/')) : _.takeRight(file.split('/'), 2);
                        const item = fileParts.length === 2 ?
                            { Album: { S: fileParts[0] }, Song: { S: fileParts[1] }, Artist: { S: keyName }, Genre: { S: genre }, S3Key: { S: `${keyName}/${fileParts[0]}/${fileParts[1]}` } } :
                            { Song: { S: fileParts }, Album: { S: keyName }, Genre: { S: genre },  S3Key: { S: `${keyName}/${fileParts}` } };
                        console.log(item);
                    })
                    done();
                })
                .catch(err => {
                    console.log(`Uh oh spaghettios! Something went wrong when uploading your files: ${err.message}`);
                    done();
                });
        }
    }
};
