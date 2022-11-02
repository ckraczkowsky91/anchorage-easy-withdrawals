const COLUMNS = [
  "sendingVaultId",
  "assetType",
  "destinationAddress",
  "amount",
  "destinationType",
  "institutionName",
  "institutionCountry",
  "recipientType",
  "recipientName",
  "recipientCountry",
];

const validateCsv = (transactions) => {
  if (!transactionToInspect || !Object.keys(transactionToInspect).length) {
    throw "CSV File is empty";
  }

  const errorsFound = [];

  transactions.forEach((transaction, index) => {
    COLUMNS.forEach((col) => {
      if (!transaction[col] || !transaction[col].length) {
        errorsFound.push(`Transaction #${index + 1} is missing column ${col}`);
      }
    });
  });

  if (errorsFound.length > 0) {
    throw errorsFound.join('\n');
  }
};

export default validateCsv;