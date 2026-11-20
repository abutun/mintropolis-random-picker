export const PROTOCOL: 'mintropolis-random-picker/v1';
export const PROOF_PROTOCOL: 'mintropolis-random-picker-proof/v1';
export const ALGORITHM: 'sha256-counter-fisher-yates/v1';
export const MAX_PARTICIPANTS: 10000;
export interface Beacon { round:number; randomness:string; signature:string }
export interface QuicknetInfo { readonly public_key:string; readonly period:3; readonly genesis_time:1692803367; readonly hash:string; readonly groupHash:string; readonly schemeID:'bls-unchained-g1-rfc9380'; readonly metadata:Readonly<{beaconID:'quicknet'}> }
export const QUICKNET_INFO: Readonly<QuicknetInfo>;
export interface Manifest { protocol:typeof PROTOCOL; algorithm:typeof ALGORITHM; mode:'quick'|'scheduled'; id:string; title:string; rules:string; participants:string[]; winnerCount:number; alternateCount:number; scheduledAt:string|null; beacon:{chainHash:string;round:number}|null }
export interface ManifestInput { id:string; title?:string; rules?:string; participants:string|string[]; winnerCount:number; alternateCount?:number; scheduledAt?:string; beaconRound?:number }
export type CommitmentEvidence = Record<string,unknown>;
export interface HostReceipt extends CommitmentEvidence { type:'host-receipt'; id:string; eventId:string; manifestHash:string; committedAt:string; publicUrl:string; manifest?:Manifest }
export interface DrawProof { protocol:typeof PROOF_PROTOCOL; manifest:Manifest; manifestHash:string; entropy:{type:'local';seed:string}|{type:'drand';beacon:Beacon}; winners:string[]; alternates:string[]; commitmentEvidence:CommitmentEvidence|null }
export interface VerificationResult { valid:true; mode:'quick'|'scheduled'; manifestHash:string; winners:string[]; alternates:string[]; beaconVerified:boolean; commitment:{status:'none'|'host-attested'|'unverified-reference';prepublicationVerified:false;hostReportedBeforeBeacon:boolean|null}; warnings:string[] }
export function canonicalizeParticipants(raw:string|string[]):string[];
export function createManifest(input:ManifestInput):Manifest;
export function validateManifest(input:unknown):Manifest;
export function hashManifest(manifest:Manifest):Promise<string>;
export function quicknetRoundTime(round:number):string;
export function quicknetRoundAtOrAfter(iso:string):number;
export function drawQuick(input:Omit<ManifestInput,'id'|'scheduledAt'|'beaconRound'> & {id?:string}):Promise<DrawProof>;
export function drawCommitted(manifest:Manifest,beacon:Beacon,commitmentEvidence?:CommitmentEvidence|null):Promise<DrawProof>;
export function parseProof(json:string):DrawProof;
export function serializeProof(proof:DrawProof):string;
export function verifyProof(proof:unknown):Promise<VerificationResult>;
export function verifyQuicknetBeacon(beacon:unknown,expectedRound:number):Promise<Beacon>;
export function fetchQuicknetBeacon(round:number,options?:{signal?:AbortSignal}):Promise<Beacon>;
