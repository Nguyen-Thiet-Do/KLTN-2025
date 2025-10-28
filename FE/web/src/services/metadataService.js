// src/services/metadataService.js
import api from "./api";

/** Trả về string[] tên thể loại */
export async function getAllGenres() {
  const { data } = await api.get("/metadata/genres");
  const arr =
    (Array.isArray(data) ? data
      : Array.isArray(data?.genres) ? data.genres
      : []) || [];

  return arr
    .map(g => (typeof g === "string" ? g : (g?.name ?? "")))
    .filter(Boolean);
}

/** Trả về string[] tên tác giả */
export async function getAllAuthors() {
  const { data } = await api.get("/metadata/authors");
  const arr =
    (Array.isArray(data) ? data
      : Array.isArray(data?.authors) ? data.authors
      : []) || [];

  return arr
    .map(a => (typeof a === "string" ? a : (a?.fullName ?? "")))
    .filter(Boolean);
}

/** Trả về string[] tên nhà xuất bản */
export async function getAllPublishers() {
  const { data } = await api.get("/metadata/publishers");
  const arr =
    (Array.isArray(data) ? data
      : Array.isArray(data?.publishers) ? data.publishers
      : []) || [];

  return arr
    .map(p => (typeof p === "string" ? p : (p?.name ?? "")))
    .filter(Boolean);
}
