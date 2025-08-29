const { Sequelize } = require('sequelize');
const dbConfig = require('../config/db');

const sequelize = new Sequelize(dbConfig.database, dbConfig.user, dbConfig.password, {
  host: dbConfig.host,
  dialect: 'mysql',
  logging: false, // 배포 시에는 false로 설정
});

const db = {};

db.Sequelize = Sequelize;
db.sequelize = sequelize;

// 모델 불러오기
db.User = require('./user')(sequelize);
db.Playlist = require('./playlist')(sequelize);
db.Song = require('./song')(sequelize);
db.PlaylistSongs = require('./playlist_songs')(sequelize);
db.ShareLink = require('./share_links')(sequelize);
db.Recommendation = require('./recommendations')(sequelize);
db.Post = require('./post')(sequelize);
db.PostLike = require('./post_likes')(sequelize);
db.Follow = require('./follows')(sequelize);
db.RecentView = require('./recent_views')(sequelize);
db.LikedPlaylist = require('./liked_playlists')(sequelize);

// --- 관계(Associations) 설정 ---

// User와 Playlist (1:N)
db.User.hasMany(db.Playlist, { foreignKey: 'user_id', as: 'playlists' });
db.Playlist.belongsTo(db.User, { foreignKey: 'user_id', as: 'user' });

// Playlist와 Song (N:M)
db.Playlist.belongsToMany(db.Song, { through: db.PlaylistSongs, foreignKey: 'playlist_id', as: 'songs' });
db.Song.belongsToMany(db.Playlist, { through: db.PlaylistSongs, foreignKey: 'song_id', as: 'playlists' });

// User가 좋아요한 Playlist (N:M)
db.User.belongsToMany(db.Playlist, { through: db.LikedPlaylist, foreignKey: 'user_id', as: 'likedPlaylists' });
db.Playlist.belongsToMany(db.User, { through: db.LikedPlaylist, foreignKey: 'playlist_id', as: 'likingUsers' });

// User 간의 Follow 관계 (N:M)
db.User.belongsToMany(db.User, { through: db.Follow, foreignKey: 'follower_id', as: 'Followings', otherKey: 'following_id' });
db.User.belongsToMany(db.User, { through: db.Follow, foreignKey: 'following_id', as: 'Followers', otherKey: 'follower_id' });

// User와 Post (1:N)
db.User.hasMany(db.Post, { foreignKey: 'user_id', as: 'posts' });
db.Post.belongsTo(db.User, { foreignKey: 'user_id', as: 'user' });

// Playlist와 Post (1:1)
db.Playlist.hasOne(db.Post, { foreignKey: 'playlist_id', as: 'post' });
db.Post.belongsTo(db.Playlist, { foreignKey: 'playlist_id', as: 'playlist' });

// User가 좋아요한 Post (N:M)
db.User.belongsToMany(db.Post, { through: db.PostLike, foreignKey: 'user_id', as: 'likedPosts' });
db.Post.belongsToMany(db.User, { through: db.PostLike, foreignKey: 'post_id', as: 'postLikingUsers' });

// Playlist와 ShareLink (1:N)
db.Playlist.hasMany(db.ShareLink, { foreignKey: 'playlist_id', as: 'shareLinks' });
db.ShareLink.belongsTo(db.Playlist, { foreignKey: 'playlist_id', as: 'playlist' });

// User/Playlist 추천 관계
db.User.hasMany(db.Recommendation, { foreignKey: 'user_id', as: 'recommendations' });
db.Recommendation.belongsTo(db.User, { foreignKey: 'user_id', as: 'user' });
db.Playlist.hasMany(db.Recommendation, { foreignKey: 'playlist_id', as: 'recommendedTo' });
db.Recommendation.belongsTo(db.Playlist, { foreignKey: 'playlist_id', as: 'playlist' });

// User의 최근 본 Playlist (N:M)
db.User.belongsToMany(db.Playlist, { through: db.RecentView, foreignKey: 'user_id', as: 'recentViewPlaylists' });
db.Playlist.belongsToMany(db.User, { through: db.RecentView, foreignKey: 'playlist_id', as: 'recentViewingUsers' });


module.exports = db;