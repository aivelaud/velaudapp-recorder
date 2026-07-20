cmake_minimum_required(VERSION 3.13)

set(CMAKE_VERBOSE_MAKEFILE on)
add_compile_options(-fexceptions -frtti -std=c++17 -Wall)

# Codegen tarafından üretilen C++ kaynakları (TypeScript spec'lerinden)
# Uygulama özel spec yoksa bu glob boş döner — sorun değil
file(GLOB react_codegen_SRCS CONFIGURE_DEPENDS
    "${PROJECT_BUILD_DIR}/generated/source/codegen/jni/*.cpp"
)

# add_library en az bir kaynak dosyası ister
if(NOT react_codegen_SRCS)
    set(PLACEHOLDER "${CMAKE_CURRENT_BINARY_DIR}/velaud_placeholder.cpp")
    file(WRITE ${PLACEHOLDER} "// Velaud Recorder — Java-only native modules, no C++ TurboModules\n")
    set(react_codegen_SRCS ${PLACEHOLDER})
endif()

add_library(${CMAKE_PROJECT_NAME} SHARED ${react_codegen_SRCS})

target_include_directories(
    ${CMAKE_PROJECT_NAME} PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}
    "${PROJECT_BUILD_DIR}/generated/source/codegen/jni"
    "${PROJECT_BUILD_DIR}/generated/autolinking/src/main/cpp"
)

# react_codegen_rncore: built-in TurboModule specs (StatusBarManager dahil)
# turbomodulejsijni: TurboModule JS bridge
# reactnativejni: core RN JNI library
target_link_libraries(
    ${CMAKE_PROJECT_NAME}
    react_codegen_rncore
    jsi
    turbomodulejsijni
    reactnativejni
)
