#include <vector>
#include <omp.h>
#include <stdio.h>

template<typename T>
std::vector<std::vector<T>> tensorProduct(T Fr, std::vector<std::vector<T>> _array1, std::vector<std::vector<T>> _array2) {
    if (_array1.size() == 1 && _array1[0].size() == 1) {
        if (Fr == _array1[0][0]) {
            return {{Fr}};
        }
    }
    if (_array2.size() == 1 && _array2[0].size() == 1) {
        if (Fr == _array2[0][0]) {
            return {{Fr}};
        }
    }

    std::vector<std::vector<T>> product(_array1.size(), std::vector<T>(_array2[0].size()));

    #pragma omp parallel for
    for (size_t i = 0; i < _array1.size(); i++) {
        for (size_t j = 0; j < _array2[0].size(); j++) {
            product[i][j] = _array2[0][j] * _array1[i][0];
        }
    }

    return product;
}
