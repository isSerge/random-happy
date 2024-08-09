export interface TransactionData {
  address: `0x${string}`,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  abi: any,
  functionName: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: any[],
}

export interface TransactionWithDeadline {
  txData: TransactionData,
  deadline: bigint,
  notBefore?: bigint; // Optional field to specify the earliest time the transaction can be included
}
