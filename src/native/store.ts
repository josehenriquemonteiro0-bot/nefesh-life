/**
 * Ponte para a assinatura NEFESH Premium no iPhone (plugin StoreKit 2 em ios/App/App/StorePlugin.swift).
 * Na web não há loja: a assinatura faz-se na app do iPhone e chega à web pela conta.
 */
import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { isNative } from '../domain/platform';
import { PLANS, type StoreTransaction } from '../domain/premium';

export interface StoreProduct {
  id: string;
  name: string;
  price: string;
  value: number;
  currency: string;
  periodDays?: number;
  trialDays?: number;
  trialEligible?: boolean;
}
interface NefeshStorePlugin {
  products(o: { ids: string[] }): Promise<{ products: StoreProduct[] }>;
  purchase(o: { id: string }): Promise<StoreTransaction & { status: 'ok' | 'cancelado' | 'pendente' }>;
  entitlements(): Promise<{ transactions: StoreTransaction[] }>;
  restore(): Promise<{ transactions: StoreTransaction[] }>;
  manage(): Promise<void>;
  addListener(e: 'transaction', fn: (t: StoreTransaction) => void): Promise<PluginListenerHandle>;
}
const Store = registerPlugin<NefeshStorePlugin>('NefeshStore');

export const storeAvailable = () => isNative();
export const storeProducts = async () => (storeAvailable() ? (await Store.products({ ids: [PLANS.anual.id, PLANS.mensal.id] })).products : []);
export const storeBuy = (id: string) => Store.purchase({ id });
export const storeEntitlements = async () => (storeAvailable() ? (await Store.entitlements()).transactions : []);
export const storeRestore = async () => (await Store.restore()).transactions;
export const storeManage = () => Store.manage();
export const onStoreTransaction = (fn: (t: StoreTransaction) => void) => (storeAvailable() ? Store.addListener('transaction', fn) : null);
