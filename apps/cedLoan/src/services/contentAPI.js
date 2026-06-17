const API_BASE_URL =
  process.env.REACT_APP_API_URL || "http://localhost:5000/api";

// Cache for content data
let contentCache = {
  data: null,
  timestamp: null,
  expiry: 5 * 60 * 1000, // 5 minutes
};

class ContentAPI {
  // Get all content
  static async getAllContent() {
    try {
      const response = await fetch(`${API_BASE_URL}/content`);
      const data = await response.json();

      if (data.success) {
        return data.data;
      } else {
        throw new Error(data.message || "Failed to fetch content");
      }
    } catch (error) {
      console.error("Error fetching all content:", error);
      return this.getDefaultContent();
    }
  }

  // Get content by type
  static async getContentByType(type) {
    try {
      const response = await fetch(`${API_BASE_URL}/content?type=${type}`);
      const data = await response.json();

      if (data.success) {
        return data.data;
      } else {
        throw new Error(data.message || `Failed to fetch ${type} content`);
      }
    } catch (error) {
      console.error(`Error fetching ${type} content:`, error);
      return this.getDefaultContentByType(type);
    }
  }

  // Get content by key
  static async getContentByKey(key) {
    try {
      const response = await fetch(`${API_BASE_URL}/content/${key}`);
      const data = await response.json();

      if (data.success) {
        return data.data;
      } else {
        throw new Error(
          data.message || `Failed to fetch content for key: ${key}`,
        );
      }
    } catch (error) {
      console.error(`Error fetching content for key ${key}:`, error);
      return null;
    }
  }

  // Get FAQ content with caching
  static async getFAQContent() {
    return this.getCachedContentByType("faq");
  }

  // Get process guide content with caching
  static async getProcessGuideContent() {
    return this.getCachedContentByType("process_guide");
  }

  // Get contact info with caching
  static async getContactInfo() {
    return this.getCachedContentByType("contact_info");
  }

  // Get cached content by type
  static async getCachedContentByType(type) {
    const cacheKey = `${type}_cache`;
    const cached = contentCache[cacheKey];

    if (
      cached &&
      cached.timestamp &&
      Date.now() - cached.timestamp < contentCache.expiry
    ) {
      return cached.data;
    }

    try {
      const content = await this.getContentByType(type);
      contentCache[cacheKey] = {
        data: content,
        timestamp: Date.now(),
      };
      return content;
    } catch (error) {
      console.error(`Error fetching cached ${type} content:`, error);
      return this.getDefaultContentByType(type);
    }
  }

  // Clear cache
  static clearCache() {
    contentCache = {
      data: null,
      timestamp: null,
      expiry: 5 * 60 * 1000,
    };
  }

  // Get default content when API fails
  static getDefaultContent() {
    return {
      faq: this.getDefaultContentByType("faq"),
      process_guide: this.getDefaultContentByType("process_guide"),
      contact_info: this.getDefaultContentByType("contact_info"),
    };
  }

  // Get default content by type - removed mock data, app should rely on database only
  static getDefaultContentByType(type) {
    console.warn(
      `No content found for type: ${type}. Please ensure content is properly seeded in the database.`,
    );
    return [];
  }
}

export default ContentAPI;
