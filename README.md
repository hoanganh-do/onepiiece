/*
Cấu trúc src 
*/

onepiiece/
├── .github/
│   └── workflows/
│       └── playwright.yml       # Cấu hình chạy CI/CD (GitHub Actions)
├── data/                        # Test data (JSON, CSV, hoặc file mock)
│   ├── users.json
│   └── products.json
├── fixtures/                    # Custom Playwright Fixtures (khởi tạo page, login sẵn...)
│   └── baseTest.ts
├── pages/                       # Page Object Model (Định nghĩa locator và actions của từng trang)
│   ├── BasePage.ts              # Page cơ sở chứa các hàm dùng chung
│   ├── LoginPage.ts
│   └── DashboardPage.ts             
├── tests/                       # Các file kịch bản kiểm thử (Test specs)
│   ├── authen/
│   │   └── login.spec.ts
│   └── dashboard/
│       └── dashboard.spec.ts
├── utils/                       # Hàm tiện ích (Helper/Utils: format date, random data, API request...)
│   └── apiHelpers.ts
├── .gitignore
├── package.json                 # Khai báo script và dependencies
├── playwright.config.ts         # File cấu hình gốc của Playwright (timeout, browser, reporter, baseURL...)
└── tsconfig.json                # Cấu hình TypeScript
