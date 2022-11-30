const redis = require("redis");

const pub = redis.createClient({
  url: "redis://redis:6379",
  legacyMode: true,
});
const sub = redis.createClient({
  url: "redis://redis:6379",
  legacyMode: true,
});

sub.on("connect", () => {
  console.log("Sub Redis client connected");
});

const resolvePromise = (resolve, reject) => {
  return (err, data) => {
    if (err) {
      reject(err);
    }
    resolve(data);
  };
};

module.exports = {
  pub,
  sub,
  auth: async () => {
    await auth(client);
    await auth(sub);
  },
  del: (key = "key") =>
    new Promise((a, b) => client.del(key, resolvePromise(a, b))),
  incr: (key = "key") =>
    new Promise((a, b) => client.incr(key, resolvePromise(a, b))),
  decr: (key = "key") =>
    new Promise((a, b) => client.decr(key, resolvePromise(a, b))),
  hincrby: (key = "key", key2 = "", value) =>
    new Promise((a, b) =>
      client.hincrby(key, key2, value, resolvePromise(a, b))
    ),
  hmset: (key = "key", values = []) =>
    new Promise((a, b) => client.hmset(key, values, resolvePromise(a, b))),
  exists: (key = "key") =>
    new Promise((a, b) => client.exists(key, resolvePromise(a, b))),
  hexists: (key = "key", key2 = "") =>
    new Promise((a, b) => client.hexists(key, key2, resolvePromise(a, b))),
  setex: (key = "key", expiration, value) =>
    new Promise((a, b) =>
      client.setex(key, expiration, value, resolvePromise(a, b))
    ),
  set: (key = "key", value) =>
    new Promise((a, b) => client.set(key, value, resolvePromise(a, b))),
  hset: (key = "key", key2 = "", value) =>
    new Promise((a, b) => client.hset(key, key2, value, resolvePromise(a, b))),
  get: (key = "key") =>
    new Promise((a, b) => client.get(key, resolvePromise(a, b))),
  hget: (key = "key", key2 = "") =>
    new Promise((a, b) => client.hget(key, key2, resolvePromise(a, b))),
  hgetall: (key = "key") =>
    new Promise((a, b) => client.hgetall(key, resolvePromise(a, b))),
  zrangebyscore: (key = "key", min = 0, max = 1) =>
    new Promise((a, b) =>
      client.zrangebyscore(key, min, max, resolvePromise(a, b))
    ),
  zrevrange: (key = "key", min = 0, max = 1) =>
    new Promise((a, b) =>
      client.zrevrange(key, min, max, resolvePromise(a, b))
    ),
  zremrangebyrank: (key = "key", min = 0, max = 1) =>
    new Promise((a, b) =>
      client.zremrangebyrank(key, min, max, resolvePromise(a, b))
    ),
  zadd: (key = "key", key2 = "", value) =>
    new Promise((a, b) => client.zadd(key, key2, value, resolvePromise(a, b))),
  sadd: (key = "key", value) =>
    new Promise((a, b) => client.sadd(key, value, resolvePromise(a, b))),
  hmget: (key = "key", key2 = "") =>
    new Promise((a, b) => client.hmget(key, key2, resolvePromise(a, b))),
  smembers: (key = "key") =>
    new Promise((a, b) => client.smembers(key, resolvePromise(a, b))),
};
