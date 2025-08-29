const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('Song', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    spotify_id: { type: DataTypes.STRING(255), unique: true },
    title: { type: DataTypes.STRING(255) },
    artist: { type: DataTypes.STRING(255) },
    album: { type: DataTypes.STRING(255) },
    preview_url: { type: DataTypes.STRING(500) },
  }, {
    tableName: 'songs',
    timestamps: false,
  });
};