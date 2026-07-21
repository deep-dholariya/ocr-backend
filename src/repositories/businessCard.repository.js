import BusinessCard from "../models/BusinessCard.js";

/**
 * Escapes RegExp special characters in user-supplied search input.
 * Without this, a search query is interpolated directly into a MongoDB
 * $regex, which lets a user submit a malicious/pathological pattern
 * (regex injection / ReDoS) instead of a literal search string.
 */
const escapeRegex = (value = "") =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

class BusinessCardRepository {
  /**
   * Create Business Card
   */
  async create(cardData) {
    return await BusinessCard.create(cardData);
  }

  /**
   * Get All Business Cards of User
   */
  async findAllByUser(userId) {
    return await BusinessCard.find({
      user: userId,
    })
      .sort({ createdAt: -1 })
      .lean();
  }

  /**
   * Get All Business Cards of User (Paginated)
   */
  async findAllByUserPaginated(
    userId,
    page = 1,
    limit = 20
  ) {
    const skip = (page - 1) * limit;

    return await BusinessCard.find({
      user: userId,
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
  }

  /**
   * Search Business Cards
   */
  async search(
    userId,
    q,
    page = 1,
    limit = 20
  ) {
    const skip = (page - 1) * limit;
    const safeQ = escapeRegex(q);

    const filter = {
      user: userId,
      $or: [
        {
          name: {
            $regex: safeQ,
            $options: "i",
          },
        },
        {
          company: {
            $regex: safeQ,
            $options: "i",
          },
        },
        {
          designation: {
            $regex: safeQ,
            $options: "i",
          },
        },
        {
          email: {
            $regex: safeQ,
            $options: "i",
          },
        },
        {
          phone: {
            $regex: safeQ,
            $options: "i",
          },
        },
        {
          website: {
            $regex: safeQ,
            $options: "i",
          },
        },
        {
          address: {
            $regex: safeQ,
            $options: "i",
          },
        },
      ],
    };

    const [cards, total] = await Promise.all([
      BusinessCard.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      BusinessCard.countDocuments(filter),
    ]);

    return {
      cards,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get Business Card By Id
   */
  async findById(id) {
    return await BusinessCard.findById(id).lean();
  }

  /**
   * Get Business Card By Id & User
   */
  async findByIdAndUser(id, userId) {
    return await BusinessCard.findOne({
      _id: id,
      user: userId,
    }).lean();
  }

  /**
   * Update Business Card
   */
  async update(id, data) {
    return await BusinessCard.findByIdAndUpdate(
      id,
      data,
      {
        new: true,
        runValidators: true,
      }
    ).lean();
  }

  /**
   * Delete Business Card
   */
  async delete(id) {
    return await BusinessCard.findByIdAndDelete(
      id
    ).lean();
  }

  /**
   * Total Cards of User
   */
  async count(userId) {
    return await BusinessCard.countDocuments({
      user: userId,
    });
  }
}

export default new BusinessCardRepository();