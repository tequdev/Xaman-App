/**
 * Transaction Details screen
 */
import { find } from 'lodash';

import React, { Component } from 'react';
import {
    View,
    Text,
    ScrollView,
    Platform,
    Linking,
    Alert,
    InteractionManager,
    TouchableOpacity,
    Share,
} from 'react-native';

import { TransactionsType } from '@common/libs/ledger/transactions/types';
import { AppScreens, AppConfig } from '@common/constants';
import { NormalizeCurrencyCode } from '@common/libs/utils';

import { ActionSheet } from '@common/helpers/interface';
import { Navigator } from '@common/helpers/navigator';

import { Header, QRCode, Spacer } from '@components/General';

import { BackendService, SocketService } from '@services';

import CoreRepository from '@store/repositories/core';
import { CoreSchema } from '@store/schemas/latest';

import { NodeChain } from '@store/types';

import Localize from '@locale';
// style
import { AppStyles } from '@theme';
import styles from './styles';

/* types ==================================================================== */
export interface Props {
    tx: TransactionsType;
    account: string;
}

export interface State {
    coreSettings: CoreSchema;
    connectedChain: NodeChain;
    scamAlert: boolean;
    showMemo: boolean;
}

/* Component ==================================================================== */
class TransactionDetailsView extends Component<Props, State> {
    static screenName = AppScreens.Transaction.Details;

    static options() {
        return {
            bottomTabs: { visible: false },
        };
    }

    constructor(props: Props) {
        super(props);

        this.state = {
            coreSettings: CoreRepository.getSettings(),
            connectedChain: SocketService.chain,
            scamAlert: false,
            showMemo: true,
        };
    }

    componentDidMount() {
        InteractionManager.runAfterInteractions(() => {
            this.checkForScamAlert();
        });
    }

    checkForScamAlert = async () => {
        const { tx, account } = this.props;

        // check for account  scam
        const incoming = tx.Destination?.address === account;

        if (incoming) {
            BackendService.getAccountRisk(tx.Account.address)
                .then((accountRisk: any) => {
                    if (accountRisk && accountRisk.danger !== 'UNKNOWN') {
                        this.setState({
                            scamAlert: true,
                            showMemo: false,
                        });
                    }
                })
                .catch(() => {});
        }
    };

    getTransactionLink = () => {
        const { connectedChain, coreSettings } = this.state;
        const { tx } = this.props;

        const net = connectedChain === NodeChain.Main ? 'main' : 'test';

        const explorer = find(AppConfig.explorer, { value: coreSettings.defaultExplorer });

        return `${explorer[net]}${tx.Hash}`;
    };

    shareTxLink = () => {
        const url = this.getTransactionLink();

        Share.share({
            title: Localize.t('events.shareTransactionId'),
            message: url,
            url: undefined,
        }).catch(() => {});
    };

    openTxLink = () => {
        const url = this.getTransactionLink();
        Linking.canOpenURL(url).then((supported) => {
            if (supported) {
                Linking.openURL(url);
            } else {
                Alert.alert(Localize.t('global.error'), Localize.t('global.cannotOpenLink'));
            }
        });
    };

    showMenu = () => {
        const IosButtons = [
            Localize.t('global.share'),
            Localize.t('global.openInBrowser'),
            Localize.t('global.cancel'),
        ];
        const AndroidButtons = [Localize.t('global.share'), Localize.t('global.openInBrowser')];
        ActionSheet(
            {
                options: Platform.OS === 'ios' ? IosButtons : AndroidButtons,

                cancelButtonIndex: 2,
            },
            (buttonIndex: number) => {
                if (buttonIndex === 0) {
                    this.shareTxLink();
                }
                if (buttonIndex === 1) {
                    this.openTxLink();
                }
            },
        );
    };

    renderStatus = () => {
        const { tx } = this.props;

        return (
            <>
                {/* <View style={[AppStyles.hr, AppStyles.marginVerticalSml]} /> */}
                <Text style={[styles.labelText]}>{Localize.t('global.status')}</Text>
                <Text style={[styles.contentText]}>
                    {tx.TransactionResult.success
                        ? Localize.t('events.thisTransactionWasSuccessful')
                        : Localize.t('events.transactionFailedWithCode', { txCode: tx.TransactionResult.code })}{' '}
                    {Localize.t('events.andValidatedInLedger')}
                    <Text style={AppStyles.monoBold}> {tx.LedgerIndex} </Text>
                    {Localize.t('events.onDate')}
                    <Text style={AppStyles.monoBold}> {tx.Date}</Text>
                </Text>
            </>
        );
    };

    renderOfferCreate = () => {
        const { tx } = this.props;

        let content;

        content =
            `${tx.Account.address} offered to pay ${tx.TakerGets.value} ${NormalizeCurrencyCode(
                tx.TakerGets.currency,
            )}` +
            ` in order to receive ${tx.TakerPays.value} ${NormalizeCurrencyCode(tx.TakerPays.currency)}\n` +
            `The exchange rate for this offer is ${tx.Rate} ` +
            `${NormalizeCurrencyCode(tx.TakerPays.currency)}/${NormalizeCurrencyCode(tx.TakerGets.currency)}`;

        if (tx.OfferSequence) {
            content += `\nThe transaction will also cancel ${tx.tx.Account} 's existing offer ${tx.OfferSequence}`;
        }

        if (tx.Expiration) {
            content += `\nThe offer expires at ${tx.Expiration} unless canceled or consumed before then.`;
        }

        return content;
    };

    renderOfferCancel = () => {
        const { tx } = this.props;
        return `The transaction will cancel ${tx.Account.address} offer #${tx.OfferSequence}`;
    };

    renderPayment = () => {
        const { tx } = this.props;

        let content = `The payment is from ${tx.Account.address} to ${tx.Destination.address}`;
        if (tx.Account.tag) {
            content += `\nThe payment has a source tag:${tx.Account.tag}`;
        }
        if (tx.Destination.tag) {
            content += `\nThe payment has a destination tag: ${tx.Destination.tag}`;
        }
        content += `\n\nIt was instructed to deliver ${tx.Amount.value} ${NormalizeCurrencyCode(tx.Amount.currency)}`;
        if (tx.SendMax) {
            content += ` by spending up to ${tx.SendMax.value} ${NormalizeCurrencyCode(tx.SendMax.currency)}`;
        }
        return content;
    };

    renderAccountDelete = () => {
        const { tx } = this.props;

        let content = `It deleted account ${tx.Account.address}`;

        content += `\n\nIt was instructed to deliver remaining balance ${tx.Amount.value} ${NormalizeCurrencyCode(
            tx.Amount.currency,
        )} to ${tx.Destination.address}`;

        if (tx.Account.tag) {
            content += `\nThe transaction has a source tag:${tx.Account.tag}`;
        }
        if (tx.Destination.tag) {
            content += `\nThe transaction has a destination tag: ${tx.Destination.tag}`;
        }

        return content;
    };

    renderCheckCreate = () => {
        const { tx } = this.props;

        let content = `The check is from ${tx.Account.address} to ${tx.Destination.address}`;
        if (tx.Account.tag) {
            content += `\nThe check has a source tag:${tx.Account.tag}`;
        }
        if (tx.Destination.tag) {
            content += `\nThe check has a destination tag: ${tx.Destination.tag}`;
        }
        content += `\n\nMaximum amount of source currency the Check is allowed to debit the sender is ${
            tx.SendMax.value
        } ${NormalizeCurrencyCode(tx.SendMax.currency)}`;

        return content;
    };

    renderCheckCash = () => {
        const { tx } = this.props;

        const amount = tx.Amount || tx.DeliverMin;

        const content = `It was instructed to deliver ${amount.value} ${NormalizeCurrencyCode(amount.currency)} to ${
            tx.Account.address
        } by cashing check with ID ${tx.CheckID}`;

        return content;
    };

    renderCheckCancel = () => {
        const { tx } = this.props;
        return `The transaction will cancel check with ID ${tx.CheckID}`;
    };

    renderDepositPreauth = () => {
        const { tx } = this.props;

        if (tx.Authorize) {
            return `It authorizes ${tx.Authorize} to send payments to this account`;
        }

        return `It removes the authorization for ${tx.Unauthorize} to send payments to this account`;
    };

    renderTrustSet = () => {
        const { tx } = this.props;

        if (tx.Limit === 0) {
            return `It removed TrustLine currency ${NormalizeCurrencyCode(tx.Currency)} to ${tx.Issuer}`;
        }
        return (
            `It establishes ${tx.Limit} as the maximum amount of ${NormalizeCurrencyCode(tx.Currency)} ` +
            `from ${tx.Issuer} that ${tx.Account.address} is willing to hold.`
        );
    };

    renderDescription = () => {
        const { tx } = this.props;

        let content = '';

        switch (tx.Type) {
            case 'OfferCreate':
                content += this.renderOfferCreate();
                break;
            case 'OfferCancel':
                content += this.renderOfferCancel();
                break;
            case 'Payment':
                content += this.renderPayment();
                break;
            case 'TrustSet':
                content += this.renderTrustSet();
                break;
            case 'CheckCreate':
                content += this.renderCheckCreate();
                break;
            case 'CheckCash':
                content += this.renderCheckCash();
                break;
            case 'CheckCancel':
                content += this.renderCheckCancel();
                break;
            case 'AccountDelete':
                content += this.renderAccountDelete();
                break;
            case 'DepositPreauth':
                content += this.renderDepositPreauth();
                break;
            default:
                content += `This is a ${tx.Type} transaction`;
        }

        return (
            <>
                <View style={[AppStyles.hr, AppStyles.marginVerticalSml]} />
                <Text style={[styles.labelText]}>Description</Text>
                <Text style={[styles.contentText]}>{content}</Text>
            </>
        );
    };

    renderMemos = () => {
        const { tx } = this.props;
        const { showMemo, scamAlert } = this.state;

        if (!tx.Memos) return null;

        return (
            <>
                <View style={[AppStyles.hr, AppStyles.marginVerticalSml]} />
                <Text style={[styles.labelText]}>Memos</Text>

                {showMemo ? (
                    <Text style={[styles.contentText, scamAlert && AppStyles.colorRed]}>
                        {tx.Memos.map((m) => {
                            if (m.type === 'text/plain') {
                                return m.data;
                            }

                            return `${m.type}: ${m.data}`;
                        })}
                    </Text>
                ) : (
                    <TouchableOpacity
                        onPress={() => {
                            this.setState({ showMemo: true });
                        }}
                    >
                        <Text style={[styles.contentText, AppStyles.colorRed]}>Show Memo</Text>
                    </TouchableOpacity>
                )}
            </>
        );
    };

    renderFee = () => {
        const { tx } = this.props;

        return (
            <>
                <View style={[AppStyles.hr, AppStyles.marginVerticalSml]} />
                <Text style={[styles.labelText]}>Transaction cost</Text>
                <Text style={[styles.contentText]}>
                    Sending this transaction consumed <Text style={AppStyles.monoBold}>{tx.Fee} XRP</Text>
                </Text>
            </>
        );
    };

    render() {
        const { tx } = this.props;
        const { scamAlert } = this.state;

        return (
            <View style={AppStyles.container}>
                <Header
                    leftComponent={{
                        icon: 'IconChevronLeft',
                        onPress: () => {
                            Navigator.pop();
                        },
                    }}
                    centerComponent={{ text: Localize.t('events.transactionDetails') }}
                    rightComponent={{
                        icon: 'IconMoreHorizontal',
                        onPress: () => {
                            this.showMenu();
                        },
                    }}
                />

                {scamAlert && (
                    <View style={styles.dangerHeader}>
                        <Text style={[AppStyles.h4, AppStyles.colorWhite]}>{Localize.t('global.fraudAlert')}</Text>
                        <Text style={[AppStyles.subtext, AppStyles.textCenterAligned, AppStyles.colorWhite]}>
                            {Localize.t(
                                'global.thisAccountIsReportedAsScamOrFraudulentAddressPleaseProceedWithCaution',
                            )}
                        </Text>
                    </View>
                )}

                <ScrollView testID="transaction-details-view">
                    <View style={styles.qrCodeContainer}>
                        <Text
                            style={[
                                styles.statusText,
                                tx.TransactionResult.success ? styles.statusSuccess : styles.statusFailed,
                            ]}
                        >
                            {tx.TransactionResult.success ? 'Success' : 'Failed'}
                        </Text>
                        <View style={styles.qrImage}>
                            {/* eslint-disable-next-line */}
                            <QRCode size={170} value={this.getTransactionLink()} />
                        </View>
                        <Spacer />
                        <Text style={[styles.hashText]}>{tx.Hash}</Text>
                    </View>
                    <View style={styles.detailsContainer}>
                        {this.renderStatus()}
                        {this.renderDescription()}
                        {this.renderFee()}
                        {this.renderMemos()}
                    </View>

                    {/* renderFlags(tx); */}
                </ScrollView>
            </View>
        );
    }
}

/* Export Component ==================================================================== */
export default TransactionDetailsView;
