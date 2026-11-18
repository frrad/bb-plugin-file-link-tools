export const locales = ["en", "zh", "ko", "ja", "es", "ru"] as const;
export type Locale = (typeof locales)[number];

const english = {
  openDefaultFailed: "Could not open the file in the default application",
  openPreviewFailed: "Could not open the file in BB",
  absolutePathRequired: "An absolute local file path is required",
  regularFilesOnly: "Only regular files and folders are supported.",
    filesOnly: "This action is available only for files.",
  localThreadRequired: "File actions are available only in local threads on the primary host.",
  fileNotFound: "File not found.",
  permissionDenied: "Access to the file was denied.",
};
export type Messages = typeof english;

const catalogs: Record<Locale, Messages> = {
  en: english,
  ru: {
    openDefaultFailed: "Не удалось открыть файл в приложении по умолчанию",
    openPreviewFailed: "Не удалось открыть файл в BB",
    absolutePathRequired: "Нужен абсолютный путь к локальному файлу",
    regularFilesOnly: "Поддерживаются только обычные файлы и папки.",
    filesOnly: "Это действие доступно только для файлов.",
    localThreadRequired: "Размер файла и открытие папки доступны только в локальных тредах.",
    fileNotFound: "Файл не найден.",
    permissionDenied: "Нет доступа к файлу.",
  },
  zh: {
    openDefaultFailed: "无法使用默认应用打开文件",
    openPreviewFailed: "无法在 BB 中打开文件",
    absolutePathRequired: "需要本地文件的绝对路径",
    regularFilesOnly: "仅支持普通文件和文件夹。",
    filesOnly: "此操作仅适用于文件。",
    localThreadRequired: "文件大小和在文件夹中显示功能仅适用于本地会话。",
    fileNotFound: "找不到文件。",
    permissionDenied: "无权访问此文件。",
  },
  ko: {
    openDefaultFailed: "기본 앱으로 파일을 열 수 없습니다",
    openPreviewFailed: "BB에서 파일을 열 수 없습니다",
    absolutePathRequired: "로컬 파일의 절대 경로가 필요합니다",
    regularFilesOnly: "일반 파일과 폴더만 지원합니다.",
    filesOnly: "이 작업은 파일에만 사용할 수 있습니다.",
    localThreadRequired: "파일 크기 확인과 폴더에서 보기 기능은 로컬 스레드에서만 사용할 수 있습니다.",
    fileNotFound: "파일을 찾을 수 없습니다.",
    permissionDenied: "파일에 접근할 권한이 없습니다.",
  },
  ja: {
    openDefaultFailed: "既定のアプリでファイルを開けませんでした",
    openPreviewFailed: "BB でファイルを開けませんでした",
    absolutePathRequired: "ローカルファイルの絶対パスが必要です",
    regularFilesOnly: "通常のファイルとフォルダのみ対応しています。",
    filesOnly: "この操作はファイルにのみ対応しています。",
    localThreadRequired: "ファイルサイズの取得とフォルダ内への表示は、ローカルスレッドでのみ利用できます。",
    fileNotFound: "ファイルが見つかりません。",
    permissionDenied: "ファイルへのアクセスが拒否されました。",
  },
  es: {
    openDefaultFailed: "No se pudo abrir el archivo con la aplicación predeterminada",
    openPreviewFailed: "No se pudo abrir el archivo en BB",
    absolutePathRequired: "Se requiere una ruta absoluta a un archivo local",
    regularFilesOnly: "Solo se admiten archivos normales y carpetas.",
    filesOnly: "Esta acción solo está disponible para archivos.",
    localThreadRequired: "El tamaño del archivo y la opción de mostrarlo en la carpeta solo están disponibles en hilos locales.",
    fileNotFound: "Archivo no encontrado.",
    permissionDenied: "Se denegó el acceso al archivo.",
  },
};

export function resolveLocale(language: string): Locale {
  const tag = language.trim().toLowerCase().replaceAll("_", "-");
  const primary = tag.split("-")[0];
  // Orca ships Simplified Chinese; Traditional Chinese locales use English.
  if (primary === "zh" && /^(?:zh-tw|zh-hk|zh-hant)(?:-|$)/u.test(tag)) return "en";
  return locales.find(locale => locale === primary) ?? "en";
}

export function getMessages(locale: Locale): Messages {
  return catalogs[locale];
}
