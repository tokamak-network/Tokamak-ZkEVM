#pragma once
#include <stdio.h>

#define DLLEXPORT extern "C" __declspec(DLLEXPORT)

DLLEXPORT std::vector<std::vector<T>> tensorProduct();
DLLEXPORT