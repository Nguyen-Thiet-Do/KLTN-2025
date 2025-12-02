// src/api/reviewApi.js
import api from "./api";

export const reviewApi = {
  async getReviews(documentId) {
    try {
      const response = await api.get(`/reviews/${documentId}`);
      return response;
    } catch (error) {
      console.error('Error fetching reviews:', error);
      throw error;
    }
  },

  async getReviewStats(documentId) {
    try {
      const response = await api.get(`/reviews/${documentId}/stats`);
      return response;
    } catch (error) {
      console.error('Error fetching review stats:', error);
      throw error;
    }
  },

  async addReview(data) {
    try {
      const response = await api.post("/reviews", data);
      return response;
    } catch (error) {
      console.error('Error adding review:', error);
      throw error;
    }
  },

  async updateReview(reviewId, data) {
    try {
      const response = await api.patch(`/reviews/${reviewId}`, data);
      return response;
    } catch (error) {
      console.error('Error updating review:', error);
      throw error;
    }
  },

  async deleteReview(reviewId) {
    try {
      const response = await api.delete(`/reviews/${reviewId}`);
      return response;
    } catch (error) {
      console.error('Error deleting review:', error);
      throw error;
    }
  }
};