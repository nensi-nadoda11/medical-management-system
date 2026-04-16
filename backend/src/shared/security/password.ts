import {
  randomBytes,
  scrypt,
  timingSafeEqual,
  type ScryptOptions,
} from "crypto";

const KEY_LENGTH = 64;
const SCRYPT_PARAMS = {
  N: 16384,
  r: 8,
  p: 1,
} as const;

const deriveKey = (password: string, salt: string, keyLength: number, options: ScryptOptions) =>
  new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, keyLength, options, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(derivedKey as Buffer);
    });
  });

export const hashPassword = async (password: string) => {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = await deriveKey(password, salt, KEY_LENGTH, SCRYPT_PARAMS);

  return [
    "scrypt",
    SCRYPT_PARAMS.N,
    SCRYPT_PARAMS.r,
    SCRYPT_PARAMS.p,
    salt,
    derivedKey.toString("hex"),
  ].join("$");
};

export const verifyPassword = async (password: string, passwordHash: string) => {
  const [algorithm, n, r, p, salt, storedHash] = passwordHash.split("$");

  if (algorithm !== "scrypt" || !n || !r || !p || !salt || !storedHash) {
    return false;
  }

  const derivedKey = await deriveKey(password, salt, storedHash.length / 2, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });

  const storedBuffer = Buffer.from(storedHash, "hex");

  return (
    storedBuffer.length === derivedKey.length &&
    timingSafeEqual(storedBuffer, derivedKey)
  );
};
