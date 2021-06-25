import AWS from 'aws-sdk/global';
import S3 from 'aws-sdk/clients/s3';

export class S3Controller {
    s3: S3;
    bucketName = "speakeasy-profile-images";

    constructor() {
        AWS.config.region = 'us-west-2';
        AWS.config.credentials = new AWS.CognitoIdentityCredentials({
            IdentityPoolId: 'us-west-2:6270b2c8-5086-4631-9d85-b97ee44eb25f',
        });

        this.s3 = new S3({
            apiVersion: "2006-03-01",
            params: { Bucket: this.bucketName }
        });
    }
}