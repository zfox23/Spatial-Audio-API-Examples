const { Client } = require('pg')
const auth = require('../../../auth.json');

export enum ServerAnalyticsEventCategory {
    ServerStartup = "Server Started Up",
    SlackBotAdded = "Slack Bot Added",
    SlackBotInstallerInfoCollected = "Slack Bot Installer Info Collected",
    SlackBotAdminInfoCollected = "Slack Bot Admin Info Collected",
    SlackBotUsed = "Slack Bot Used",
    UserConnected = "User Connected",
    UserDisconnected = "User Disconnected",
}

export class ServerStartupEvent {
    constructor() {}
}
export class SlackBotAddedEvent {
    constructor() {}
}
export class SlackBotInstallerInfoCollectedEvent {
    info: any;

    constructor(info: any) {
        this.info = info;
    }
}
export class SlackBotAdminInfoCollectedEvent {
    info: any;

    constructor(info: any) {
        this.info = info;
    }
}
export class SlackBotUsedEvent {
    user_id: string;
    team_id: string;
    containedExplicitRoomName: boolean;

    constructor(user_id: string, team_id: string, containedExplicitRoomName: boolean) {
        this.user_id = user_id;
        this.team_id = team_id;
        this.containedExplicitRoomName = containedExplicitRoomName;
    }
}
export class UserConnectedOrDisconnectedEvent {
    spaceName: string;
    userUUID: string;
    sessionStartTimestamp: number;

    constructor(spaceName: string, userUUID: string, sessionStartTimestamp: number) {
        this.spaceName = spaceName;
        this.userUUID = userUUID;
        this.sessionStartTimestamp = sessionStartTimestamp;
    }
}

export class ServerAnalyticsController {
    postgresClient: any;

    constructor() {
        if (!(auth.ANALYTICS_POSTGRES_DB_USER && auth.ANALYTICS_POSTGRES_DB_HOST && auth.ANALYTICS_POSTGRES_DB_DATABASE && auth.ANALYTICS_POSTGRES_DB_PASSWORD && auth.ANALYTICS_POSTGRES_DB_PORT)) {
            return;
        }

        // You must have already created the database specified by "database" here.
        let clientAuth = {
            user: auth.ANALYTICS_POSTGRES_DB_USER,
            host: auth.ANALYTICS_POSTGRES_DB_HOST,
            database: auth.ANALYTICS_POSTGRES_DB_DATABASE,
            password: auth.ANALYTICS_POSTGRES_DB_PASSWORD,
            port: auth.ANALYTICS_POSTGRES_DB_PORT,
        };
        this.postgresClient = new Client(clientAuth);

        this.connectToDB();
    }

    async maybeCreateTable() {
        const checkTableText = `SELECT to_regclass('analytics.events');`
        const result = await this.postgresClient.query(checkTableText);
        
        if (result.rows[0]["to_regclass"] === null) {
            const createTableText = `CREATE TABLE analytics.events
(
    id serial NOT NULL,
    "timestamp" timestamp with time zone,
    category text,
    details text,
    PRIMARY KEY (id)
);`
            await this.postgresClient.query(createTableText);
        }
    }

    async connectToDB() {
        await this.postgresClient.connect();

        await this.maybeCreateTable();

        this.logEvent(ServerAnalyticsEventCategory.ServerStartup);
    }

    async logEvent(category: ServerAnalyticsEventCategory, details?: any) {
        if (!this.postgresClient) {
            return;
        }

        let timestamp = new Date();
        let detailsText: string;
        let e: any;

        switch (category) {
            case ServerAnalyticsEventCategory.SlackBotInstallerInfoCollected:
                e = <SlackBotInstallerInfoCollectedEvent>details;
                detailsText = JSON.stringify(e.info);
                break;
            case ServerAnalyticsEventCategory.SlackBotAdminInfoCollected:
                e = <SlackBotAdminInfoCollectedEvent>details;
                detailsText = JSON.stringify(e.info);
                break;
            case ServerAnalyticsEventCategory.SlackBotUsed:
                e = <SlackBotUsedEvent>details;
    
                let isHiFiEmployee = false;
                let slackTeamID = e.team_id;
                if (slackTeamID && slackTeamID === "T025Q3X6R") {
                    isHiFiEmployee = true;
                }

                detailsText = `${isHiFiEmployee ? "HIFI EMPLOYEE " : ""}${e.team_id}/${e.user_id} used the Slack bot. Their request ${e.containedExplicitRoomName ? "DID" : "DID NOT"} explicitly ask for a room name.`;
                break;
            case ServerAnalyticsEventCategory.UserConnected:
            case ServerAnalyticsEventCategory.UserDisconnected:
                e = <UserConnectedOrDisconnectedEvent>details;
                detailsText = `${e.spaceName}/${e.userUUID}/${e.sessionStartTimestamp}`;
                break;
            default:
                if (details) {
                    detailsText = JSON.stringify(details);
                }
                break;
        }

        if (detailsText) {
            console.log(`Analytic @ ${timestamp}: ${category}: ${detailsText}`);
            let insertText = `INSERT INTO analytics.events(timestamp, category, details) VALUES ($1, $2, $3);`;
            await this.postgresClient.query(insertText, [timestamp, category, detailsText]);
        } else {
            console.log(`Analytic @ ${timestamp}: ${category}`);
            let insertText = `INSERT INTO analytics.events(timestamp, category) VALUES ($1, $2);`;
            await this.postgresClient.query(insertText, [timestamp, category]);
        }
    }
}