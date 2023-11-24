/* eslint-disable spellcheck/spell-checker */
/* eslint-disable max-len */

import { SetRegularKey } from '../SetRegularKey';
import setRegularKeyTemplates from './fixtures/SetRegularKeyTx.json';

jest.mock('@services/NetworkService');

describe('SetRegularKey tx', () => {
    it('Should set tx type if not set', () => {
        const instance = new SetRegularKey();
        expect(instance.TransactionType).toBe('SetRegularKey');
        expect(instance.Type).toBe('SetRegularKey');
    });

    it('Should return right parsed values', () => {
        // @ts-ignore
        const { tx, meta } = setRegularKeyTemplates;
        const instance = new SetRegularKey(tx, meta);

        expect(instance.RegularKey).toBe('rAR8rR8sUkBoCZFawhkWzY4Y5YoyuznwD');
    });
});