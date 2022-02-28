import { get, has } from 'lodash';

import { LedgerTransactionType, TransactionJSONType } from '@common/libs/ledger/types';

import * as Transactions from '@common/libs/ledger/transactions';
import { TransactionsType } from '@common/libs/ledger/transactions/types';

const TransactionFactory = {
    getTransaction: (transaction: TransactionJSONType, meta?: any): TransactionsType => {
        // get the transaction type
        const type = get(transaction, ['TransactionType'], undefined);
        // get transaction class
        const Transaction = get(Transactions, type, Transactions.BaseTransaction);
        return new Transaction(transaction, meta);
    },

    fromLedger: (item: LedgerTransactionType): TransactionsType => {
        if (!has(item, 'tx') || !has(item, 'meta')) {
            throw new Error('item is not a valid Ledger transaction type!');
        }

        const transaction = get(item, 'tx');
        const meta = get(item, 'meta');
        return TransactionFactory.getTransaction(transaction, meta);
    },

    fromJson: (item: TransactionJSONType): TransactionsType => {
        return TransactionFactory.getTransaction(item);
    },
};

export default TransactionFactory;
