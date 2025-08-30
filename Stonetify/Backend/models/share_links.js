const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('ShareLink', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    playlist_id: { type: DataTypes.INTEGER, allowNull: false },
    share_id: { type: DataTypes.STRING(255), unique: true, allowNull: false },
    share_url: { type: DataTypes.STRING(500), allowNull: false },
    qr_code_url: { type: DataTypes.STRING(500) },
    created_by: { type: DataTypes.INTEGER },
    view_count: { type: DataTypes.INTEGER, defaultValue: 0 },
    share_count: { type: DataTypes.INTEGER, defaultValue: 0 },
    is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
  }, {
    tableName: 'share_links',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  });
};