const { db, COLLECTIONS, RealtimeDBHelpers } = require('../config/firebase');
const bcrypt = require('bcryptjs');

// 연쇄 삭제를 위해 다른 모델들 import
const Playlist = require('./playlist');
const Post = require('./post');
const LikedPlaylist = require('./liked_playlists');
const SongLike = require('./song_likes');
const Follow = require('./follows');
const SpotifyToken = require('./spotify_token');
const PlaybackHistory = require('./playback_history');

class User {
  static async create(userData) {
    const { display_name, email, password, kakaoId, naverId, profile_image } = userData;

    let hashedPassword = null;
    if (password) {
      if (!/\$2[aby]\$/.test(password)) {
        const salt = await bcrypt.genSalt(10);
        hashedPassword = await bcrypt.hash(password, salt);
      } else {
        hashedPassword = password;
      }
    }

    const user = {
      display_name,
      email,
      password: hashedPassword,
      profile_image_url: profile_image || null,
      profile_image: profile_image || null,
      bio: '',
      kakao_id: kakaoId || null,
      naver_id: naverId || null,
      created_at: Date.now(),
      updated_at: Date.now()
    };

    const userId = await RealtimeDBHelpers.createDocument(COLLECTIONS.USERS, user);
    return userId;
  }

  static async findById(id) {
    return await RealtimeDBHelpers.getDocumentById(COLLECTIONS.USERS, id);
  }

  static async findByEmail(email) {
    const allUsers = await RealtimeDBHelpers.getAllDocuments(COLLECTIONS.USERS);
    const user = allUsers.find(user => user.email === email);
    return user || null;
  }

  static async findByDisplayName(displayName) {
    const allUsers = await RealtimeDBHelpers.getAllDocuments(COLLECTIONS.USERS);
    const user = allUsers.find(user => user.display_name === displayName);
    return user || null;
  }

  static async findByKakaoId(kakaoId) {
    const allUsers = await RealtimeDBHelpers.getAllDocuments(COLLECTIONS.USERS);
    return allUsers.find(user => user.kakao_id === kakaoId) || null;
  }

  static async findByNaverId(naverId) {
    const allUsers = await RealtimeDBHelpers.getAllDocuments(COLLECTIONS.USERS);
    return allUsers.find(user => user.naver_id === naverId) || null;
  }

  static async update(id, userData) {
    const updateData = {
      ...userData,
      updated_at: Date.now()
    };

    Object.keys(updateData).forEach((key) => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    if (updateData.password) {
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(updateData.password, salt);
    }

    await RealtimeDBHelpers.updateDocument(COLLECTIONS.USERS, id, updateData);
    return await this.findById(id);
  }

  static async delete(id) {
    await RealtimeDBHelpers.deleteDocument(COLLECTIONS.USERS, id);
  }

  static async validatePassword(user, password) {
    if (!user.password) {
      return false;
    }

    try {
      return await bcrypt.compare(password, user.password);
    } catch (error) {
      return false;
    }
  }

  static async searchUsers(query, limit = 10) {
    const allUsers = await RealtimeDBHelpers.getAllDocuments(COLLECTIONS.USERS);
    const filteredUsers = allUsers.filter(user => {
      const nameMatch = user.display_name && user.display_name.toLowerCase().includes(query.toLowerCase());
      const emailMatch = user.email && user.email.toLowerCase().includes(query.toLowerCase());
      return nameMatch || emailMatch;
    });
    return filteredUsers.slice(0, limit);
  }

  static async getAllUsers() {
    return await RealtimeDBHelpers.getAllDocuments(COLLECTIONS.USERS);
  }

  static async delete(userId) {
    console.log(`[User.delete] Deleting all data for user: ${userId}`);

    try {
      // 1. 유저의 플레이리스트 (및 관련 데이터) 삭제
      const playlists = await Playlist.findByUserId(userId);
      for (const playlist of playlists) {
        await Playlist.delete(playlist.id); // Playlist.delete가 연쇄 삭제 처리
      }

      // 2. 유저의 게시물 (및 관련 데이터) 삭제
      const posts = await Post.findByUserId(userId);
      for (const post of posts) {
        await Post.delete(post.id); // Post.delete가 연쇄 삭제 처리
      }

      // 3. 유저가 누른 플레이리스트 좋아요 삭제
      const likedPlaylists = await LikedPlaylist.findByUserId(userId);
      for (const like of likedPlaylists) {
        await LikedPlaylist.delete(like.id);
      }

      // 4. 유저가 누른 곡 좋아요 삭제
      const songLikes = await SongLike.findByUserId(userId);
      for (const like of songLikes) {
        await SongLike.delete(like.id);
      }

      // 5. 유저의 팔로우/팔로워 관계 삭제
      const following = await Follow.findByFollowerId(userId);
      for (const f of following) {
        await Follow.delete(f.id);
      }
      const followers = await Follow.findByFollowingId(userId);
      for (const f of followers) {
        await Follow.delete(f.id);
      }
      
      // 6. 유저의 Spotify 토큰 삭제
      const token = await SpotifyToken.getByUser(userId);
      if (token) {
        await SpotifyToken.delete(token.id);
      }

      // 7. 유저의 재생 기록 삭제
      const history = await PlaybackHistory.findByUserId(userId);
      for (const h of history) {
        await PlaybackHistory.delete(h.id);
      }

      // 8. 유저 본인 삭제
      await RealtimeDBHelpers.deleteDocument(COLLECTIONS.USERS, userId);
      console.log(`[User.delete] Successfully deleted user: ${userId}`);
      
    } catch (error) {
      console.error(`[User.delete] Error deleting data for user ${userId}:`, error);
      throw new Error('Failed to delete user data: ' + error.message);
    }
  }
}

module.exports = User;