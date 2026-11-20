# Luyện thi KTCT Mác – Lênin

Website tĩnh luyện thi cuối kì môn **Kinh tế chính trị Mác – Lênin** (SMT1006 – ĐH Kinh tế, ĐH Đà Nẵng), gồm **hai phần có chức năng tương đương**:

| Phần | Nguồn dữ liệu |
|---|---|
| **Ôn chính** | Đề cương, hệ thống lý thuyết, công thức và 12 bài tập có lời giải trong bộ tài liệu của bạn |
| **Luyện thêm** | Câu hỏi công khai từ khóa học Studocu (33 bộ quiz) |

## Chức năng

- **Trắc nghiệm** (Đúng/Sai + nhiều lựa chọn): chấm điểm tự động, hiện đáp án và giải thích.
- **Tự luận**: nhập câu trả lời vào khung, sau khi nộp hiện **đáp án mẫu** để tự dò.
- **Bài tập**: đề tính toán + lời giải từng bước sau khi nộp.
- **Thẻ ghi nhớ**: lật thẻ khái niệm ↔ định nghĩa, đánh dấu “đã nhớ”.
- **Ngân hàng câu hỏi**: tìm kiếm, lọc theo chương/dạng, xem đáp án.
- **Random đề**: xáo trộn câu hỏi và đáp án mỗi lần bắt đầu.
- **Chế độ**: Luyện tập (hiện đáp án ngay) hoặc Thi thử (nộp bài mới xem).
- Lưu tiến độ, lịch sử làm bài, thẻ đã nhớ bằng `localStorage`.

## Chạy local

```bash
npm install
npm run dev
```

Mở http://localhost:5173

## Dữ liệu

```bash
npm run build-bank    # tạo data/questions.json + public/data/questions.json từ tài liệu local và crawl/parsed
npm run validate      # kiểm tra schema, đáp án, câu thiếu
npm run crawl         # crawl lại các quiz trong crawl/targets.json (cần agent-browser + Chrome)
```

- `crawl/targets.json`: danh sách quiz nguồn.
- `crawl/parsed/`: dữ liệu thô đã crawl (có đáp án đúng từ payload của trang).
- `content/core-curated.json`: câu tự luận/đúng-sai biên soạn từ đề cương.
- `scripts/extract-quiz.js`: đoạn script chạy trong trang để lấy dữ liệu quiz.

Crawl dùng `agent-browser` ở chế độ có giao diện (`--headed`) vì Studocu chặn truy cập trực tiếp:

```bash
npm i -g agent-browser
agent-browser install
npm run crawl
```

## Build & deploy GitHub Pages

```bash
npm run build
```

Workflow `.github/workflows/deploy.yml` tự build và deploy khi push lên `main`. Trên GitHub: **Settings → Pages → Source = GitHub Actions**.

Vite dùng `base: '/KTCT-Mac/'` khi chạy trong GitHub Actions (theo tên repo).

## Ghi nguồn & bản quyền

- Phần **Ôn chính** dựa trên tài liệu ôn tập của người dùng.
- Phần **Luyện thêm** dùng câu hỏi công khai từ [Studocu – Kinh tế chính trị Mác Lênin (SMT1006)](https://www.studocu.vn/vn/course/truong-dai-hoc-kinh-te-dai-hoc-da-nang/kinh-te-chinh-tri-mac-lenin/5955041). Nội dung thuộc bản quyền của tác giả/người đăng tải, chỉ dùng cho mục đích học tập cá nhân. Trang có `noindex` để hạn chế bị công cụ tìm kiếm thu thập.
