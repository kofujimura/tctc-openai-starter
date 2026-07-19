import config from "../../config/tctc.config.json";

export const GATE_ROLE_NAME = "OPENAI_CALLER_ROLE";

const defaultChain = config.chains[config.defaultChain as keyof typeof config.chains];
const role = config.roles[GATE_ROLE_NAME];
const controlToken = role.controlTokens[0];

if (!defaultChain || !controlToken) {
  throw new Error("The default gate policy is incomplete.");
}

export const GATE_CHAIN_ID = defaultChain.chainId;

export type PublicGateConfig = {
  chain: string;
  chainId: number;
  contractAddress: string;
  model: string;
  role: string;
  standard: string;
  tokenId?: number;
};

export function getPublicGateConfig(): PublicGateConfig {
  return {
    chain: config.defaultChain,
    chainId: defaultChain.chainId,
    contractAddress: controlToken.address,
    model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
    role: GATE_ROLE_NAME,
    standard: controlToken.standard,
    tokenId: "typeId" in controlToken ? controlToken.typeId : undefined,
  };
}
