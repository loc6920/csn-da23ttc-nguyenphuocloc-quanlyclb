Nguyễn Phước Lộc 
110123126

Đây là dự án web quản lý câu lạc bộ sử dụng Firebase

Thư mục public chứa các code ở đề tài
Firebase.json và .firebaserc là chứa phần các phần hosting của đề tài

vào trang web  https://firebase.google.com/ ,tạo một dự án trên firebase, xong add firestore, fire auth và firehosting
sau đó vào phần dự án đã tạo nhấn vào project overview chọn project setting Chọn CND để tiến hành cài đặt SDK cho firebase xong copy code đó vào phần firebase_config.js
vào phần docs của firebase tìm firestore và auth chọn vào web để import vào file config, sau đó tiến hành để đường dẫn cho firestore thành "https://www.gstatic.com/firebasejs/12.7.0/firebase-SERVICE.js" và auth thành "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js"

cách cài Firebase hosting:
yêu cầu: cài node.js
Mở công cụ Vs code mở file dự án lên, vào phần terminal gõ: 
cài cls: npm install -g firebase-tools
khởi tạo hosting: firebase init hosting
build và deploy web: 'npm run build' 'firebase deploy --only hosting' 
vậy web đã được deploy
để tắt deploy: firebase hosting:disable
