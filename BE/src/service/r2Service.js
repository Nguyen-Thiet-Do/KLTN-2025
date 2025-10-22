const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const r2 = require("../config/r2");
const crypto = require("crypto");

const s3 = new S3Client({
  region: "auto",
  endpoint: r2.endpoint(),
  credentials: { accessKeyId: r2.accessKeyId, secretAccessKey: r2.secretAccessKey },
  forcePathStyle: true
});

function makeKey(prefix, originalName) {
  const ext = (originalName?.split(".").pop() || "").toLowerCase();
  const uid = crypto.randomUUID().replace(/-/g, "");
  return `${prefix}${uid}${ext ? "." + ext : ""}`;
}

async function uploadCover(file) {
  const key = makeKey("covers/", file.originalname);
  await s3.send(new PutObjectCommand({
    Bucket: r2.bucket,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype,
    // cache dài cho ảnh bìa
    CacheControl: "public, max-age=31536000, immutable"
  }));
  return { key };
}

async function uploadEbook(file) {
  const key = makeKey("ebooks/", file.originalname);
  await s3.send(new PutObjectCommand({
    Bucket: r2.bucket,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype
  }));
  return { key };
}

async function getObject({ key, range }) {
  const cmd = new GetObjectCommand({
    Bucket: r2.bucket,
    Key: key,
    Range: range
  });
  return await s3.send(cmd); // trả stream + headers
}

async function deleteObject(key) {
  await s3.send(new DeleteObjectCommand({ Bucket: r2.bucket, Key: key }));
}

module.exports = { uploadCover, uploadEbook, getObject, deleteObject };
