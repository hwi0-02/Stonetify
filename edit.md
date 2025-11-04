FeedScreen.js 팔로잉 리스트, 좋아요, 저장, 작성한 피드 스크린 모듈 생성 
    - FollowingListScreen.js
    - LikedPostsScreen.js
    - SavedScreen.js
    - MyFeedScreen.js 내가 작성한 피드 스크린 이동
ProfileScreen.js 로그아웃 시 확인 토스트 생성
EditProfileScreen.js 버튼 수정, 텍스트 삭제, 회원 탈퇴 기능 추가 

1. Backtend
[playlistController.js](Backend/controllers/playlistController.js)
[playlistRoutes.js](Backend/routes/playlistRoutes.js)

탈퇴 기능
[playback_history.js](Backend/models/playback_history.js)
[spotify_token.js](Backend/models/spotify_token.js)
[user.js](Backend/models/user.js)
[userController.js](Backend/controllers/userController.js)

2. Frontend
[playlistSlice.js](Frontend/store/slices/playlistSlice.js)
[apiService.js](Frontend/services/apiService.js)
[FeedScreen.js]Frontend/screens/FeedScreen.js
[ProfileScreen.js](Frontend/screens/ProfileScreen.js)
[userRoutes.js](Backend/routes/userRoutes.js)

탈퇴 기능
[apiService.js](Frontend/services/apiService.js)
[authSlice.js](Frontend/store/slices/authSlice.js)
[EditProfileScreen.js](Frontend/screens/EditProfileScreen.js)

 