import { neon } from "@neondatabase/serverless";

const NullishQueryFunction = () => {
  throw new Error(
    "No database connection string was provided to `neon()`. Perhaps process.env.DATABASE_URL has not been set",
  );
};
NullishQueryFunction.transaction = () => {
  throw new Error(
    "No database connection string was provided to `neon()`. Perhaps process.env.DATABASE_URL has not been set",
  );
};

const baseSql = process.env.DATABASE_URL
  ? neon(process.env.DATABASE_URL)
  : NullishQueryFunction;

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 500;

function isRetryableError(err) {
  const msg = (err?.message || "").toLowerCase();
  return (
    msg.includes("timeout") ||
    msg.includes("connection") ||
    msg.includes("fetch failed") ||
    msg.includes("econnreset") ||
    msg.includes("socket hang up")
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Wrap the tagged-template / function call with retry logic
const sql = function (stringsOrQuery, ...values) {
  const attempt = async (retries) => {
    try {
      // Supports both tagged template and function form
      if (Array.isArray(stringsOrQuery) && stringsOrQuery.raw) {
        return await baseSql(stringsOrQuery, ...values);
      }
      return await baseSql(stringsOrQuery, ...values);
    } catch (err) {
      if (retries > 0 && isRetryableError(err)) {
        console.warn(
          `[sql] Retryable error, ${retries} retries left: ${err.message}`,
        );
        await sleep(RETRY_DELAY_MS);
        return attempt(retries - 1);
      }
      throw err;
    }
  };
  return attempt(MAX_RETRIES);
};

// Preserve transaction support
sql.transaction = baseSql.transaction
  ? (...args) => {
      const attempt = async (retries) => {
        try {
          return await baseSql.transaction(...args);
        } catch (err) {
          if (retries > 0 && isRetryableError(err)) {
            console.warn(
              `[sql.transaction] Retryable error, ${retries} retries left: ${err.message}`,
            );
            await sleep(RETRY_DELAY_MS);
            return attempt(retries - 1);
          }
          throw err;
        }
      };
      return attempt(MAX_RETRIES);
    }
  : NullishQueryFunction.transaction;

export default sql;
