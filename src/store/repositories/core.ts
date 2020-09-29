import { assign } from 'lodash';

import Realm, { ObjectSchema, Results } from 'realm';
import DeviceInfo from 'react-native-device-info';
import crashlytics from '@react-native-firebase/crashlytics';

import { SHA512, HMAC256 } from '@common/libs/crypto';

import { AppConfig } from '@common/constants';

import { CoreSchema } from '@store/schemas/latest';
import { NodeChain } from '@store/types';

import BaseRepository from './base';

/* types  ==================================================================== */

// events
declare interface CoreRepository {
    on(event: 'updateSettings', listener: (settings: CoreSchema, changes: Partial<CoreSchema>) => void): this;
    on(event: string, listener: Function): this;
}

/* repository  ==================================================================== */
class CoreRepository extends BaseRepository {
    realm: Realm;
    schema: ObjectSchema;

    initialize(realm: Realm) {
        this.realm = realm;
        this.schema = CoreSchema.schema;
    }

    saveSettings = (settings: Partial<CoreSchema>) => {
        const current = this.getSettings(true);

        if (current) {
            this.safeWrite(() => {
                assign(current, settings);

                this.emit('updateSettings', current, settings);
            });
        } else {
            this.create(settings);
        }
    };

    getDefaultNode = () => {
        let defaultNode = __DEV__ ? AppConfig.nodes.test[0] : AppConfig.nodes.main[0];
        let chain = NodeChain.Main;

        const settings = this.getSettings();

        if (settings && settings.defaultNode) {
            defaultNode = settings.defaultNode;
        }

        // it is a verified type
        if (AppConfig.nodes.main.indexOf(defaultNode) > -1) {
            chain = NodeChain.Main;
        } else if (AppConfig.nodes.test.indexOf(defaultNode) > -1) {
            chain = NodeChain.Test;
        }

        return {
            node: defaultNode,
            chain,
        };
    };

    getSettings = (plain?: boolean): CoreSchema => {
        const result = this.findAll() as Results<CoreSchema>;

        // settings exist
        if (!result.isEmpty()) {
            if (plain) {
                return result[0];
            }
            return this.normalizeObject(result[0]);
        }

        return undefined;
    };

    encryptPasscode = async (passcode: string): Promise<string> => {
        try {
            // for better security we mix passcode with device uuid
            // because it will be used to encrypt private key and storing just passcode-hash is not a good idea
            const deviceUUID = DeviceInfo.getUniqueId();

            // hash the passcode
            const hashPasscode = await SHA512(passcode);
            const encPasscode = await HMAC256(hashPasscode, deviceUUID);

            return encPasscode;
        } catch (e) {
            crashlytics().log('Encrypt Passcode Failed');
            crashlytics().recordError(e);
            return '';
        }
    };

    setPasscode = async (passcode: string): Promise<string> => {
        try {
            const encryptedPasscode = await this.encryptPasscode(passcode);

            // unable to encrypt passcode
            if (!encryptedPasscode) {
                return '';
            }

            // save in the store
            this.saveSettings({ passcode: encryptedPasscode });

            return encryptedPasscode;
        } catch (e) {
            crashlytics().log('Save Passcode Failed');
            crashlytics().recordError(e);
            return '';
        }
    };

    /**
     * Purge everything
     * WARNING: This will delete all objects in the Realm!
     */
    purge = (): void => {
        this.realm.write(() => {
            this.realm.deleteAll();
        });
    };
}

export default new CoreRepository();
